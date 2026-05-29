#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "usage: $0 <imm-source-dir> <rust-target> [out-dir]" >&2
  exit 64
fi

source_dir=$(cd "$1" && pwd)
target=$2
out_dir=${3:-dist}

case "$target" in
  aarch64-apple-darwin)
    artifact_arch=arm64
    ;;
  x86_64-apple-darwin)
    artifact_arch=x64
    ;;
  *)
    echo "unsupported macOS target: $target" >&2
    exit 64
    ;;
esac

mkdir -p "$out_dir"

CARGO_TARGET_DIR="$source_dir/target" cargo build --release --locked --target "$target" --manifest-path "$source_dir/Cargo.toml"

stage=$(mktemp -d)
cleanup() {
  rm -rf "$stage"
}
trap cleanup EXIT

package_root="$stage/imm"
mkdir -p "$package_root/bin"
install -m 755 "$source_dir/target/$target/release/imm-native" "$package_root/bin/imm"
tar -C "$stage" -czf "$out_dir/imm-macos-${artifact_arch}.tar.gz" imm/bin/imm

if ! tar -tzf "$out_dir/imm-macos-${artifact_arch}.tar.gz" | grep -qx "imm/bin/imm"; then
  echo "macOS tarball is missing imm/bin/imm" >&2
  exit 1
fi
