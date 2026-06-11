# IMM Registry

Standalone registry server for IMM libraries.

The public API is read-only for clients. Package publishing is intentionally
limited to the internal admin web UI.

## Run Locally

```bash
docker compose up --build
```

- Public UI: <http://localhost:8080>
- Admin UI: <http://localhost:8080/admin>
- Dev admin token: `dev-admin-token`

If port `8080` is already in use:

```bash
IMM_REGISTRY_PORT=18080 docker compose up --build
```

The development `IMM_REGISTRY_PUBLIC_BASE_URL` follows `IMM_REGISTRY_PORT`, so
API download URLs use the same host port.

The development compose file runs its own Postgres and stores package archives
under `./storage`.

## Production Shape

Production uses an external Postgres URL and a server-side filesystem storage
path supplied by environment variables.

```bash
cp .env.example .env
docker compose -f docker-compose.prod.yml --env-file .env up --build -d
```

Important variables:

- `DATABASE_URL`: production Postgres connection string.
- `IMM_REGISTRY_STORAGE_ROOT`: container path where package archives are stored.
- `IMM_REGISTRY_STORAGE_HOST_PATH`: host path mounted to `IMM_REGISTRY_STORAGE_ROOT`.
- `IMM_REGISTRY_PUBLIC_BASE_URL`: public registry URL used in API responses.
- `IMM_REGISTRY_ADMIN_TOKEN`: token required by internal admin upload routes.
- `IMM_REGISTRY_MAX_UPLOAD_BYTES`: maximum upload size, default `26214400`.

## Package Upload

Upload a gzip-compressed tar archive (`.imm.tgz`) through `/admin`.

The archive must contain `imm.toml` at its root:

```toml
[package]
name = "pathkit"
version = "0.2.1"
imm = ">=0.2,<0.3"
description = "Path helpers for IMM"

[exports]
pathkit = "src/pathkit.imm"

[dependencies]
```

Package names are also IMM import names, so they must start with a lowercase
ASCII letter and may only contain lowercase letters, digits, and underscores.

Archive paths must be relative and cannot contain `.` or `..`. `name@version`
is immutable. Publish a new version for fixes, or yank the old version.
Archive writes use a temporary file plus rename. If database registration fails
after storing the archive, the server removes the stored file and records no
published version.

## Read API

```http
GET /api/v1/search?q=path
GET /api/v1/packages/:name
GET /api/v1/packages/:name/versions/:version
GET /api/v1/packages/:name/versions/:version/download
```

Admin write API:

```http
POST /admin/api/v1/packages
POST /admin/api/v1/packages/:name/versions/:version/yank
```

Send the admin token as either `Authorization: Bearer <token>` or
`x-admin-token: <token>`.
