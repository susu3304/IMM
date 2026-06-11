use std::collections::{BTreeMap, BTreeSet};
use std::io::{Cursor, Read};
use std::path::{Component, Path};

use flate2::read::GzDecoder;
use semver::Version;
use serde::Serialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use tar::Archive;
use toml::Value as TomlValue;

use crate::error::AppError;

#[derive(Clone, Debug, Serialize)]
pub struct PackageManifest {
    pub name: String,
    pub version: String,
    pub imm_range: Option<String>,
    pub description: Option<String>,
    pub repository: Option<String>,
    pub exports: BTreeMap<String, String>,
    pub dependencies: serde_json::Value,
}

#[derive(Clone, Debug)]
pub struct PackageArchive {
    pub manifest: PackageManifest,
    pub readme: Option<String>,
    pub sha256: String,
    pub size_bytes: i64,
}

pub fn inspect_archive(bytes: &[u8]) -> Result<PackageArchive, AppError> {
    if bytes.is_empty() {
        return Err(AppError::bad_request("archive is empty"));
    }

    let sha256 = hex::encode(Sha256::digest(bytes));
    let mut archive = Archive::new(GzDecoder::new(Cursor::new(bytes)));
    let mut manifest_source = None;
    let mut readme = None;
    let mut files = BTreeSet::new();

    for entry in archive
        .entries()
        .map_err(|_| AppError::bad_request("archive must be a gzip-compressed tar file"))?
    {
        let mut entry =
            entry.map_err(|_| AppError::bad_request("archive contains an unreadable entry"))?;
        if !entry.header().entry_type().is_file() {
            continue;
        }

        let path = entry
            .path()
            .map_err(|_| AppError::bad_request("archive contains an invalid path"))?;
        validate_archive_path(&path)?;
        let path = normalize_archive_path(&path);
        files.insert(path.clone());

        if path == "imm.toml" {
            let mut source = String::new();
            entry
                .read_to_string(&mut source)
                .map_err(|_| AppError::bad_request("imm.toml is not valid UTF-8"))?;
            manifest_source = Some(source);
        } else if path == "README.md" || path == "README" {
            let mut source = String::new();
            entry
                .read_to_string(&mut source)
                .map_err(|_| AppError::bad_request("README is not valid UTF-8"))?;
            readme = Some(source);
        }
    }

    let manifest_source =
        manifest_source.ok_or_else(|| AppError::bad_request("archive must contain imm.toml"))?;
    let manifest = parse_manifest(&manifest_source, &files)?;

    Ok(PackageArchive {
        manifest,
        readme,
        sha256,
        size_bytes: bytes.len() as i64,
    })
}

fn parse_manifest(source: &str, files: &BTreeSet<String>) -> Result<PackageManifest, AppError> {
    let document: TomlValue = toml::from_str(source)
        .map_err(|err| AppError::bad_request(format!("invalid imm.toml: {err}")))?;
    let package = document
        .get("package")
        .and_then(TomlValue::as_table)
        .ok_or_else(|| AppError::bad_request("imm.toml must contain [package]"))?;

    let name = required_string(package, "name")?;
    validate_package_name(&name)?;
    let version = required_string(package, "version")?;
    Version::parse(&version)
        .map_err(|err| AppError::bad_request(format!("invalid package version: {err}")))?;

    let imm_range = optional_string(package, "imm");
    let description = optional_string(package, "description");
    let repository = optional_string(package, "repository");
    let exports = parse_exports(&document, &name, files)?;
    let dependencies = document
        .get("dependencies")
        .map(toml_to_json)
        .unwrap_or_else(|| json!({}));

    Ok(PackageManifest {
        name,
        version,
        imm_range,
        description,
        repository,
        exports,
        dependencies,
    })
}

fn parse_exports(
    document: &TomlValue,
    package_name: &str,
    files: &BTreeSet<String>,
) -> Result<BTreeMap<String, String>, AppError> {
    let mut exports = BTreeMap::new();
    if let Some(table) = document.get("exports").and_then(TomlValue::as_table) {
        for (name, value) in table {
            validate_export_name(name)?;
            let Some(path) = value.as_str() else {
                return Err(AppError::bad_request(format!(
                    "export {name} must point to a source path"
                )));
            };
            validate_manifest_path(path)?;
            if !files.contains(path) {
                return Err(AppError::bad_request(format!(
                    "export {name} points to missing file {path}"
                )));
            }
            exports.insert(name.clone(), path.to_string());
        }
    }

    if exports.is_empty() {
        let default = format!("src/{package_name}.imm");
        if files.contains(&default) {
            exports.insert(package_name.to_string(), default);
        }
    }

    if exports.is_empty() {
        return Err(AppError::bad_request(
            "imm.toml must contain [exports], or src/<package-name>.imm must exist",
        ));
    }

    Ok(exports)
}

fn required_string(
    table: &toml::map::Map<String, TomlValue>,
    key: &str,
) -> Result<String, AppError> {
    table
        .get(key)
        .and_then(TomlValue::as_str)
        .map(str::to_string)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| AppError::bad_request(format!("[package].{key} is required")))
}

fn optional_string(table: &toml::map::Map<String, TomlValue>, key: &str) -> Option<String> {
    table
        .get(key)
        .and_then(TomlValue::as_str)
        .map(str::to_string)
        .filter(|value| !value.trim().is_empty())
}

fn toml_to_json(value: &TomlValue) -> serde_json::Value {
    serde_json::to_value(value).unwrap_or_else(|_| json!({}))
}

fn validate_package_name(name: &str) -> Result<(), AppError> {
    let mut chars = name.chars();
    let Some(first) = chars.next() else {
        return Err(AppError::bad_request("package name is required"));
    };
    if !first.is_ascii_lowercase() {
        return Err(AppError::bad_request(
            "package name must start with a lowercase ASCII letter",
        ));
    }
    if name.len() > 64
        || !chars.all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_')
    {
        return Err(AppError::bad_request(
            "package name may contain lowercase letters, digits, and underscores",
        ));
    }
    Ok(())
}

fn validate_export_name(name: &str) -> Result<(), AppError> {
    let mut chars = name.chars();
    let Some(first) = chars.next() else {
        return Err(AppError::bad_request("export name is required"));
    };
    if !(first.is_ascii_lowercase() || first == '_') {
        return Err(AppError::bad_request(format!(
            "export {name} must start with a lowercase letter or underscore"
        )));
    }
    if !chars.all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '_') {
        return Err(AppError::bad_request(format!(
            "export {name} must be a valid IMM identifier"
        )));
    }
    Ok(())
}

fn validate_manifest_path(path: &str) -> Result<(), AppError> {
    if path.is_empty() {
        return Err(AppError::bad_request("manifest path is empty"));
    }
    validate_archive_path(Path::new(path))
}

fn validate_archive_path(path: &Path) -> Result<(), AppError> {
    if path.is_absolute() {
        return Err(AppError::bad_request(
            "archive paths must be relative and cannot be absolute",
        ));
    }
    for component in path.components() {
        match component {
            Component::Normal(_) => {}
            _ => {
                return Err(AppError::bad_request(
                    "archive paths cannot contain '.', '..', or prefixes",
                ));
            }
        }
    }
    Ok(())
}

fn normalize_archive_path(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().to_string()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use tar::{Builder, Header};

    #[test]
    fn rejects_unsafe_paths() {
        assert!(validate_archive_path(Path::new("../imm.toml")).is_err());
        assert!(validate_archive_path(Path::new("/tmp/imm.toml")).is_err());
        assert!(validate_archive_path(Path::new("src/lib.imm")).is_ok());
    }

    #[test]
    fn parses_manifest_with_exports() {
        let mut files = BTreeSet::new();
        files.insert("src/pathkit.imm".to_string());
        let manifest = parse_manifest(
            r#"
[package]
name = "pathkit"
version = "0.2.1"
imm = ">=0.2,<0.3"
description = "Path helpers"

[exports]
pathkit = "src/pathkit.imm"
"#,
            &files,
        )
        .unwrap();

        assert_eq!(manifest.name, "pathkit");
        assert_eq!(manifest.version, "0.2.1");
        assert_eq!(manifest.exports["pathkit"], "src/pathkit.imm");
    }

    #[test]
    fn inspects_package_archive() {
        let bytes = test_archive(&[
            (
                "imm.toml",
                r#"
[package]
name = "pathkit"
version = "0.2.1"

[exports]
pathkit = "src/pathkit.imm"
"#,
            ),
            ("README.md", "# Pathkit\n"),
            ("src/pathkit.imm", "dig answer() { return 42 }\n"),
        ]);

        let archive = inspect_archive(&bytes).unwrap();
        assert_eq!(archive.manifest.name, "pathkit");
        assert_eq!(archive.manifest.version, "0.2.1");
        assert_eq!(archive.manifest.exports["pathkit"], "src/pathkit.imm");
        assert_eq!(archive.sha256.len(), 64);
        assert!(archive.readme.unwrap().contains("Pathkit"));
    }

    fn test_archive(files: &[(&str, &str)]) -> Vec<u8> {
        let mut gzip = GzEncoder::new(Vec::new(), Compression::default());
        {
            let mut builder = Builder::new(&mut gzip);
            for (path, content) in files {
                let bytes = content.as_bytes();
                let mut header = Header::new_gnu();
                header.set_path(path).unwrap();
                header.set_size(bytes.len() as u64);
                header.set_mode(0o644);
                header.set_cksum();
                builder.append(&header, bytes).unwrap();
            }
            builder.finish().unwrap();
        }
        gzip.finish().unwrap()
    }
}
