use std::sync::Arc;

use axum::body::Body;
use axum::extract::{Multipart, Path, Query, State};
use axum::http::header::{AUTHORIZATION, CONTENT_DISPOSITION, CONTENT_TYPE, USER_AGENT};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use semver::Version;
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::postgres::PgRow;
use sqlx::{FromRow, PgPool, Row};
use tower_http::trace::TraceLayer;

use crate::config::Config;
use crate::error::AppError;
use crate::manifest::{inspect_archive, PackageArchive, PackageManifest};
use crate::storage::Storage;
use crate::web;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Arc<Config>,
    pub storage: Storage,
}

pub fn router(state: AppState) -> Router {
    let max_upload_bytes = state.config.max_upload_bytes;
    Router::new()
        .route("/", get(web::index))
        .route("/admin", get(web::admin))
        .route("/health", get(health))
        .route("/api/v1/search", get(search))
        .route("/api/v1/packages/{name}", get(package_detail))
        .route(
            "/api/v1/packages/{name}/versions/{version}",
            get(version_detail),
        )
        .route(
            "/api/v1/packages/{name}/versions/{version}/download",
            get(download),
        )
        .route("/admin/api/v1/packages", post(admin_upload))
        .route(
            "/admin/api/v1/packages/{name}/versions/{version}/yank",
            post(admin_yank),
        )
        .layer(axum::extract::DefaultBodyLimit::max(max_upload_bytes))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse { ok: true })
}

#[derive(Serialize)]
struct HealthResponse {
    ok: bool,
}

#[derive(Debug, Deserialize)]
struct SearchQuery {
    q: Option<String>,
    limit: Option<i64>,
}

#[derive(Debug, Serialize)]
struct SearchResponse {
    packages: Vec<PackageSummary>,
}

#[derive(Debug, Serialize)]
struct PackageSummary {
    name: String,
    description: Option<String>,
    repository: Option<String>,
    latest_version: Option<String>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, FromRow)]
struct PackageRow {
    name: String,
    description: Option<String>,
    repository: Option<String>,
    latest_version: Option<String>,
    updated_at: DateTime<Utc>,
}

async fn search(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<SearchResponse>, AppError> {
    let needle = query.q.unwrap_or_default();
    let limit = query.limit.unwrap_or(50).clamp(1, 100);
    let like = format!("%{}%", needle.to_lowercase());
    let rows = sqlx::query_as::<_, PackageRow>(
        r#"
        SELECT name, description, repository, latest_version, updated_at
        FROM packages
        WHERE LOWER(name) LIKE $1 OR LOWER(COALESCE(description, '')) LIKE $1
        ORDER BY updated_at DESC, name ASC
        LIMIT $2
        "#,
    )
    .bind(like)
    .bind(limit)
    .fetch_all(&state.pool)
    .await?;

    Ok(Json(SearchResponse {
        packages: rows
            .into_iter()
            .map(|row| PackageSummary {
                name: row.name,
                description: row.description,
                repository: row.repository,
                latest_version: row.latest_version,
                updated_at: row.updated_at,
            })
            .collect(),
    }))
}

#[derive(Debug, Serialize)]
struct PackageDetail {
    name: String,
    description: Option<String>,
    repository: Option<String>,
    latest_version: Option<String>,
    updated_at: DateTime<Utc>,
    versions: Vec<VersionSummary>,
}

#[derive(Debug, Serialize)]
struct VersionSummary {
    version: String,
    imm_range: Option<String>,
    sha256: String,
    yanked: bool,
    published_at: DateTime<Utc>,
}

#[derive(Debug, FromRow)]
struct VersionSummaryRow {
    version: String,
    imm_range: Option<String>,
    sha256: String,
    yanked: bool,
    published_at: DateTime<Utc>,
}

async fn package_detail(
    State(state): State<AppState>,
    Path(name): Path<String>,
) -> Result<Json<PackageDetail>, AppError> {
    let package = sqlx::query_as::<_, PackageRow>(
        r#"
        SELECT name, description, repository, latest_version, updated_at
        FROM packages
        WHERE name = $1
        "#,
    )
    .bind(&name)
    .fetch_optional(&state.pool)
    .await?
    .ok_or_else(|| AppError::not_found(format!("package {name} not found")))?;

    let mut versions = sqlx::query_as::<_, VersionSummaryRow>(
        r#"
        SELECT version, imm_range, sha256, yanked, published_at
        FROM package_versions
        WHERE package_name = $1
        "#,
    )
    .bind(&name)
    .fetch_all(&state.pool)
    .await?;
    versions.sort_by(|left, right| compare_versions_desc(&left.version, &right.version));

    Ok(Json(PackageDetail {
        name: package.name,
        description: package.description,
        repository: package.repository,
        latest_version: package.latest_version,
        updated_at: package.updated_at,
        versions: versions
            .into_iter()
            .map(|row| VersionSummary {
                version: row.version,
                imm_range: row.imm_range,
                sha256: row.sha256,
                yanked: row.yanked,
                published_at: row.published_at,
            })
            .collect(),
    }))
}

#[derive(Debug, Serialize)]
struct VersionDetail {
    name: String,
    version: String,
    imm_range: Option<String>,
    description: Option<String>,
    repository: Option<String>,
    exports: JsonValue,
    dependencies: JsonValue,
    archive_size_bytes: i64,
    sha256: String,
    yanked: bool,
    readme: Option<String>,
    published_at: DateTime<Utc>,
    download_url: String,
}

#[derive(Debug, FromRow)]
struct VersionRow {
    package_name: String,
    version: String,
    imm_range: Option<String>,
    description: Option<String>,
    repository: Option<String>,
    exports_json: JsonValue,
    dependencies_json: JsonValue,
    archive_path: String,
    archive_size_bytes: i64,
    sha256: String,
    yanked: bool,
    readme: Option<String>,
    published_at: DateTime<Utc>,
}

async fn version_detail(
    State(state): State<AppState>,
    Path((name, version)): Path<(String, String)>,
) -> Result<Json<VersionDetail>, AppError> {
    let row = load_version(&state.pool, &name, &version).await?;
    Ok(Json(version_response(&state.config, row)))
}

async fn download(
    State(state): State<AppState>,
    Path((name, version)): Path<(String, String)>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    let row = load_version(&state.pool, &name, &version).await?;
    if row.yanked {
        return Err(AppError::not_found(format!(
            "package {name}@{version} has been yanked"
        )));
    }

    let bytes = state.storage.read_archive(&row.archive_path).await?;
    let user_agent = headers
        .get(USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let _ = sqlx::query(
        r#"
        INSERT INTO package_downloads(package_name, version, user_agent)
        VALUES ($1, $2, $3)
        "#,
    )
    .bind(&name)
    .bind(&version)
    .bind(user_agent)
    .execute(&state.pool)
    .await;

    let file_name = format!("{name}-{version}.imm.tgz");
    let mut response = Body::from(bytes).into_response();
    response
        .headers_mut()
        .insert(CONTENT_TYPE, HeaderValue::from_static("application/gzip"));
    response.headers_mut().insert(
        CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("attachment; filename=\"{file_name}\""))
            .map_err(|_| AppError::internal("could not build download headers"))?,
    );
    Ok(response)
}

async fn admin_upload(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Json<PublishResponse>, AppError> {
    require_admin(&state, &headers)?;

    let mut archive_bytes = None;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|err| AppError::bad_request(format!("invalid multipart body: {err}")))?
    {
        if field.name() == Some("archive") {
            archive_bytes =
                Some(field.bytes().await.map_err(|err| {
                    AppError::bad_request(format!("invalid archive body: {err}"))
                })?);
            break;
        }
    }
    let archive_bytes = archive_bytes
        .ok_or_else(|| AppError::bad_request("multipart field archive is required"))?;
    let archive = inspect_archive(&archive_bytes)?;
    let name = archive.manifest.name.clone();
    let version = archive.manifest.version.clone();

    if version_exists(&state.pool, &name, &version).await? {
        return Err(AppError::conflict(format!(
            "package {name}@{version} already exists"
        )));
    }

    let archive_path = state.storage.package_archive_relative_path(&name, &version);
    state
        .storage
        .put_archive(&archive_path, &archive_bytes)
        .await?;

    if let Err(err) = insert_package_version(&state.pool, &archive, &archive_path).await {
        state.storage.remove_archive(&archive_path).await;
        return Err(err);
    }

    Ok(Json(PublishResponse {
        name: name.clone(),
        version: version.clone(),
        sha256: archive.sha256,
        archive_size_bytes: archive.size_bytes,
        download_url: download_url(&state.config, &name, &version),
    }))
}

#[derive(Debug, Serialize)]
struct PublishResponse {
    name: String,
    version: String,
    sha256: String,
    archive_size_bytes: i64,
    download_url: String,
}

async fn admin_yank(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((name, version)): Path<(String, String)>,
) -> Result<StatusCode, AppError> {
    require_admin(&state, &headers)?;
    let mut tx = state.pool.begin().await?;
    let result = sqlx::query(
        r#"
        UPDATE package_versions
        SET yanked = TRUE
        WHERE package_name = $1 AND version = $2
        "#,
    )
    .bind(&name)
    .bind(&version)
    .execute(&mut *tx)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::not_found(format!(
            "package {name}@{version} not found"
        )));
    }
    let latest = select_latest_version(&mut tx, &name).await?;
    sqlx::query(
        r#"
        UPDATE packages
        SET latest_version = $2, updated_at = now()
        WHERE name = $1
        "#,
    )
    .bind(&name)
    .bind(latest)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        r#"
        INSERT INTO audit_events(event_type, package_name, version, details_json)
        VALUES ('yank', $1, $2, '{}'::jsonb)
        "#,
    )
    .bind(&name)
    .bind(&version)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(StatusCode::NO_CONTENT)
}

fn require_admin(state: &AppState, headers: &HeaderMap) -> Result<(), AppError> {
    let Some(expected) = &state.config.admin_token else {
        return Ok(());
    };

    let bearer = headers
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "));
    let x_admin = headers
        .get("x-admin-token")
        .and_then(|value| value.to_str().ok());
    if bearer == Some(expected.as_str()) || x_admin == Some(expected.as_str()) {
        return Ok(());
    }
    Err(AppError::unauthorized("admin token is required"))
}

async fn version_exists(pool: &PgPool, name: &str, version: &str) -> Result<bool, AppError> {
    let exists = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM package_versions
            WHERE package_name = $1 AND version = $2
        )
        "#,
    )
    .bind(name)
    .bind(version)
    .fetch_one(pool)
    .await?;
    Ok(exists)
}

async fn insert_package_version(
    pool: &PgPool,
    archive: &PackageArchive,
    archive_path: &str,
) -> Result<(), AppError> {
    let manifest = &archive.manifest;
    let mut tx = pool.begin().await?;
    sqlx::query(
        r#"
        INSERT INTO packages(name, description, repository, latest_version)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO UPDATE SET
            description = COALESCE(EXCLUDED.description, packages.description),
            repository = COALESCE(EXCLUDED.repository, packages.repository),
            updated_at = now()
        "#,
    )
    .bind(&manifest.name)
    .bind(&manifest.description)
    .bind(&manifest.repository)
    .bind(&manifest.version)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO package_versions(
            package_name,
            version,
            imm_range,
            description,
            repository,
            exports_json,
            dependencies_json,
            archive_path,
            archive_size_bytes,
            sha256,
            readme
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        "#,
    )
    .bind(&manifest.name)
    .bind(&manifest.version)
    .bind(&manifest.imm_range)
    .bind(&manifest.description)
    .bind(&manifest.repository)
    .bind(serde_json::to_value(&manifest.exports).unwrap_or(JsonValue::Null))
    .bind(&manifest.dependencies)
    .bind(archive_path)
    .bind(archive.size_bytes)
    .bind(&archive.sha256)
    .bind(&archive.readme)
    .execute(&mut *tx)
    .await?;

    let latest = select_latest_version(&mut tx, &manifest.name).await?;
    sqlx::query(
        r#"
        UPDATE packages
        SET latest_version = $2, updated_at = now()
        WHERE name = $1
        "#,
    )
    .bind(&manifest.name)
    .bind(latest)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO audit_events(event_type, package_name, version, details_json)
        VALUES ('publish', $1, $2, jsonb_build_object('sha256', $3, 'size_bytes', $4))
        "#,
    )
    .bind(&manifest.name)
    .bind(&manifest.version)
    .bind(&archive.sha256)
    .bind(archive.size_bytes)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

async fn select_latest_version(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    name: &str,
) -> Result<Option<String>, AppError> {
    let rows = sqlx::query(
        r#"
        SELECT version FROM package_versions
        WHERE package_name = $1 AND yanked = FALSE
        "#,
    )
    .bind(name)
    .map(|row: PgRow| row.get::<String, _>("version"))
    .fetch_all(&mut **tx)
    .await?;

    Ok(rows
        .into_iter()
        .max_by(|left, right| compare_versions_asc(left, right)))
}

async fn load_version(pool: &PgPool, name: &str, version: &str) -> Result<VersionRow, AppError> {
    sqlx::query_as::<_, VersionRow>(
        r#"
        SELECT
            package_name,
            version,
            imm_range,
            description,
            repository,
            exports_json,
            dependencies_json,
            archive_path,
            archive_size_bytes,
            sha256,
            yanked,
            readme,
            published_at
        FROM package_versions
        WHERE package_name = $1 AND version = $2
        "#,
    )
    .bind(name)
    .bind(version)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::not_found(format!("package {name}@{version} not found")))
}

fn version_response(config: &Config, row: VersionRow) -> VersionDetail {
    VersionDetail {
        download_url: download_url(config, &row.package_name, &row.version),
        name: row.package_name,
        version: row.version,
        imm_range: row.imm_range,
        description: row.description,
        repository: row.repository,
        exports: row.exports_json,
        dependencies: row.dependencies_json,
        archive_size_bytes: row.archive_size_bytes,
        sha256: row.sha256,
        yanked: row.yanked,
        readme: row.readme,
        published_at: row.published_at,
    }
}

fn download_url(config: &Config, name: &str, version: &str) -> String {
    format!(
        "{}/api/v1/packages/{}/versions/{}/download",
        config.public_base_url, name, version
    )
}

fn compare_versions_desc(left: &str, right: &str) -> std::cmp::Ordering {
    compare_versions_asc(right, left)
}

fn compare_versions_asc(left: &str, right: &str) -> std::cmp::Ordering {
    match (Version::parse(left), Version::parse(right)) {
        (Ok(left), Ok(right)) => left.cmp(&right),
        _ => left.cmp(right),
    }
}

#[allow(dead_code)]
fn _assert_manifest_is_send_sync(_: &PackageManifest) {}
