#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "usage: $0 <imm-source-dir>" >&2
  exit 64
fi

source_dir=$1

cargo_version=$(
  awk -F '"' '
    /^\[package\]/ { in_package = 1; next }
    /^\[/ && in_package { exit }
    in_package && /^version = / { print $2; exit }
  ' "$source_dir/Cargo.toml"
)

if [ -z "$cargo_version" ]; then
  echo "could not read package version from $source_dir/Cargo.toml" >&2
  exit 1
fi

if git -C "$source_dir" rev-parse --verify HEAD >/dev/null 2>&1; then
  upstream_sha=$(git -C "$source_dir" rev-parse HEAD)
  short_sha=$(git -C "$source_dir" rev-parse --short=12 HEAD)
  commit_count=$(git -C "$source_dir" rev-list --count HEAD)
else
  upstream_sha=0000000000000000000000000000000000000000
  short_sha=000000000000
  commit_count=0
fi

IFS=. read -r major minor patch_rest <<< "$cargo_version"
patch=${patch_rest%%[-+~]*}

if [ -z "${major:-}" ] || [ -z "${minor:-}" ] || [ -z "${patch:-}" ]; then
  echo "version must look like major.minor.patch: $cargo_version" >&2
  exit 1
fi

msi_build=$commit_count
if [ "$msi_build" -gt 65535 ]; then
  msi_build=$((msi_build % 65535))
  if [ "$msi_build" -eq 0 ]; then
    msi_build=65535
  fi
fi

deb_version="${cargo_version}"
msi_version="${major}.${minor}.${patch}"
release_tag="v${cargo_version}"
release_name="IMM ${cargo_version}"

emit() {
  local key=$1
  local value=$2
  printf '%s=%s\n' "$key" "$value"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    printf '%s=%s\n' "$key" "$value" >> "$GITHUB_OUTPUT"
  fi
}

emit cargo_version "$cargo_version"
emit upstream_sha "$upstream_sha"
emit short_sha "$short_sha"
emit commit_count "$commit_count"
emit deb_version "$deb_version"
emit msi_version "$msi_version"
emit release_tag "$release_tag"
emit release_name "$release_name"
