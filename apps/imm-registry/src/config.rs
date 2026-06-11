use std::env;
use std::net::SocketAddr;
use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct Config {
    pub bind: SocketAddr,
    pub database_url: String,
    pub storage_root: PathBuf,
    pub public_base_url: String,
    pub admin_token: Option<String>,
    pub max_upload_bytes: usize,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let bind = env::var("IMM_REGISTRY_BIND")
            .unwrap_or_else(|_| "0.0.0.0:8080".to_string())
            .parse()?;
        let database_url = env::var("IMM_REGISTRY_DATABASE_URL")
            .or_else(|_| env::var("DATABASE_URL"))
            .unwrap_or_else(|_| {
                "postgres://imm_registry:imm_registry@127.0.0.1:5432/imm_registry".to_string()
            });
        let storage_root = env::var("IMM_REGISTRY_STORAGE_ROOT")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("./storage"));
        let public_base_url = env::var("IMM_REGISTRY_PUBLIC_BASE_URL")
            .unwrap_or_else(|_| "http://localhost:8080".to_string())
            .trim_end_matches('/')
            .to_string();
        let admin_token = env::var("IMM_REGISTRY_ADMIN_TOKEN")
            .ok()
            .filter(|value| !value.trim().is_empty());
        let max_upload_bytes = env::var("IMM_REGISTRY_MAX_UPLOAD_BYTES")
            .ok()
            .and_then(|value| value.parse::<usize>().ok())
            .unwrap_or(25 * 1024 * 1024);

        Ok(Self {
            bind,
            database_url,
            storage_root,
            public_base_url,
            admin_token,
            max_upload_bytes,
        })
    }
}
