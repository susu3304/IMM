use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use tokio::fs;

use crate::error::AppError;

#[derive(Clone, Debug)]
pub struct Storage {
    root: PathBuf,
}

impl Storage {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub async fn ensure_root(&self) -> Result<(), AppError> {
        fs::create_dir_all(&self.root).await?;
        Ok(())
    }

    pub fn package_archive_relative_path(&self, name: &str, version: &str) -> String {
        format!("packages/{name}/{version}/{name}-{version}.imm.tgz")
    }

    pub async fn put_archive(&self, relative_path: &str, bytes: &[u8]) -> Result<(), AppError> {
        validate_relative_storage_path(relative_path)?;
        let full_path = self.full_path(relative_path)?;
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        if fs::metadata(&full_path).await.is_ok() {
            return Err(AppError::conflict("archive file already exists"));
        }
        let tmp_path = full_path.with_file_name(format!(
            ".upload-{}-{}.tmp",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|duration| duration.as_nanos())
                .unwrap_or_default()
        ));
        fs::write(&tmp_path, bytes).await?;
        if let Err(err) = fs::hard_link(&tmp_path, &full_path).await {
            let _ = fs::remove_file(&tmp_path).await;
            if err.kind() == std::io::ErrorKind::AlreadyExists {
                return Err(AppError::conflict("archive file already exists"));
            }
            return Err(AppError::from(err));
        }
        let _ = fs::remove_file(&tmp_path).await;
        Ok(())
    }

    pub async fn remove_archive(&self, relative_path: &str) {
        if let Ok(full_path) = self.full_path(relative_path) {
            let _ = fs::remove_file(full_path).await;
        }
    }

    pub async fn read_archive(&self, relative_path: &str) -> Result<Vec<u8>, AppError> {
        let full_path = self.full_path(relative_path)?;
        fs::read(full_path).await.map_err(AppError::from)
    }

    fn full_path(&self, relative_path: &str) -> Result<PathBuf, AppError> {
        validate_relative_storage_path(relative_path)?;
        Ok(self.root.join(relative_path))
    }
}

fn validate_relative_storage_path(path: &str) -> Result<(), AppError> {
    let path = Path::new(path);
    if path.is_absolute() {
        return Err(AppError::bad_request("storage path must be relative"));
    }
    for component in path.components() {
        match component {
            Component::Normal(_) => {}
            _ => {
                return Err(AppError::bad_request(
                    "storage path contains unsafe components",
                ))
            }
        }
    }
    Ok(())
}
