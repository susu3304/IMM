mod config;
mod error;
mod manifest;
mod routes;
mod storage;
mod web;

use std::sync::Arc;

use sqlx::postgres::PgPoolOptions;
use tokio::net::TcpListener;
use tracing_subscriber::EnvFilter;

use crate::config::Config;
use crate::routes::{router, AppState};
use crate::storage::Storage;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("imm_registry=info".parse()?))
        .init();

    let config = Arc::new(Config::from_env()?);
    let storage = Storage::new(config.storage_root.clone());
    storage.ensure_root().await?;

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await?;
    sqlx::migrate!("./migrations").run(&pool).await?;

    if config.admin_token.is_none() {
        tracing::warn!("IMM_REGISTRY_ADMIN_TOKEN is not set; admin upload is unauthenticated");
    }

    let state = AppState {
        pool,
        config: config.clone(),
        storage,
    };
    let listener = TcpListener::bind(config.bind).await?;
    tracing::info!(bind = %config.bind, "IMM Registry listening");
    axum::serve(listener, router(state)).await?;
    Ok(())
}
