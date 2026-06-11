# IMM Registry

IMM Registry is the package registry for IMM libraries. It is intentionally
separate from `nkmzapi`.

The initial shape is:

```text
imm CLI / users
  -> public read API
  -> Postgres metadata
  -> server-side filesystem package storage

internal network admin users
  -> /admin upload UI
  -> immutable package version publication
```

There is no public CLI publish flow in this version. Package upload is done from
the internal admin web UI.

## Location

- Server crate: `apps/imm-registry`
- Docker Compose dev stack: `apps/imm-registry/docker-compose.yml`
- Production Compose template: `apps/imm-registry/docker-compose.prod.yml`
- DB migration: `apps/imm-registry/migrations/0001_init.sql`

## Run Locally

```bash
cd apps/imm-registry
docker compose up --build
```

Local services:

- Registry UI: `http://localhost:8080`
- Admin UI: `http://localhost:8080/admin`
- Dev admin token: `dev-admin-token`
- Dev Postgres: Compose-managed `postgres:16-alpine`
- Dev storage: `apps/imm-registry/storage`

If port `8080` is already in use, set a host port:

```bash
IMM_REGISTRY_PORT=18080 docker compose up --build
```

The development `IMM_REGISTRY_PUBLIC_BASE_URL` follows `IMM_REGISTRY_PORT`, so
metadata download URLs stay correct when the host port changes.

## Production Configuration

Production should use an externally managed Postgres database and a server-side
filesystem path for package archives.

```bash
cd apps/imm-registry
cp .env.example .env
docker compose -f docker-compose.prod.yml --env-file .env up --build -d
```

Important environment variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Production Postgres connection string. |
| `IMM_REGISTRY_PUBLIC_BASE_URL` | Public URL used in API responses. |
| `IMM_REGISTRY_STORAGE_ROOT` | Container path for package archives. |
| `IMM_REGISTRY_STORAGE_HOST_PATH` | Host path mounted to `IMM_REGISTRY_STORAGE_ROOT`. |
| `IMM_REGISTRY_ADMIN_TOKEN` | Token required for admin upload and yank routes. |
| `IMM_REGISTRY_MAX_UPLOAD_BYTES` | Upload body limit. Defaults to `26214400`. |
| `IMM_REGISTRY_PORT` | Host port for the API container. Defaults to `8080`. |

## Package Archive Rules

Uploads are gzip-compressed tar archives with `.imm.tgz` naming by convention.
The archive must contain `imm.toml` at its root.

```toml
[package]
name = "pathkit"
version = "0.2.1"
imm = ">=0.2,<0.3"
description = "Path helpers for IMM"

[exports]
pathkit = "src/pathkit.imm"
```

Rules enforced by the server:

- package names start with a lowercase ASCII letter
- package names contain only lowercase ASCII letters, digits, and underscores
- package versions must parse as semver
- exported source files must exist in the archive
- archive paths must be relative and cannot contain `.`, `..`, or absolute paths
- `name@version` is immutable
- fixes are new versions; bad versions are yanked
- sha256 and size are stored in Postgres

## Public API

```http
GET /api/v1/search?q=path
GET /api/v1/packages/:name
GET /api/v1/packages/:name/versions/:version
GET /api/v1/packages/:name/versions/:version/download
```

The download endpoint rejects yanked versions.

## Internal Admin API

```http
POST /admin/api/v1/packages
POST /admin/api/v1/packages/:name/versions/:version/yank
```

Admin requests must send either:

```http
Authorization: Bearer <IMM_REGISTRY_ADMIN_TOKEN>
```

or:

```http
x-admin-token: <IMM_REGISTRY_ADMIN_TOKEN>
```

## Operational Notes

- Run a single writer instance while using local filesystem storage.
- Back up Postgres and the storage directory together.
- Archive writes use temporary files and hard links to avoid overwriting an
  existing version.
- If DB registration fails after storing an archive, the server removes the file.
- `audit_events` records publish and yank actions.
- Large-package support may need streamed multipart handling later; the MVP
  reads upload bodies within `IMM_REGISTRY_MAX_UPLOAD_BYTES`.
