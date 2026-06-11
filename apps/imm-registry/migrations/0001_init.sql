CREATE TABLE IF NOT EXISTS packages (
    name TEXT PRIMARY KEY,
    description TEXT,
    repository TEXT,
    latest_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT packages_name_format CHECK (name ~ '^[a-z][a-z0-9_]{0,63}$')
);

CREATE TABLE IF NOT EXISTS package_versions (
    package_name TEXT NOT NULL REFERENCES packages(name) ON DELETE CASCADE,
    version TEXT NOT NULL,
    imm_range TEXT,
    description TEXT,
    repository TEXT,
    exports_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    dependencies_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    archive_path TEXT NOT NULL,
    archive_size_bytes BIGINT NOT NULL,
    sha256 TEXT NOT NULL,
    readme TEXT,
    yanked BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (package_name, version),
    CONSTRAINT package_versions_sha256_format CHECK (sha256 ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS package_versions_package_idx
    ON package_versions(package_name, published_at DESC);

CREATE INDEX IF NOT EXISTS package_versions_yanked_idx
    ON package_versions(package_name, yanked);

CREATE TABLE IF NOT EXISTS package_downloads (
    id BIGSERIAL PRIMARY KEY,
    package_name TEXT NOT NULL,
    version TEXT NOT NULL,
    user_agent TEXT,
    downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS package_downloads_package_idx
    ON package_downloads(package_name, version, downloaded_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
    id BIGSERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    package_name TEXT,
    version TEXT,
    details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_events_package_idx
    ON audit_events(package_name, version, created_at DESC);
