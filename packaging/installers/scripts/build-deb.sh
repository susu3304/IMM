#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "usage: $0 <imm-source-dir> <deb-version> [out-dir]" >&2
  exit 64
fi

source_dir=$(cd "$1" && pwd)
deb_version=$2
out_dir=${3:-dist}
arch=${ARCH:-amd64}
package=imm

mkdir -p "$out_dir"

CARGO_TARGET_DIR="$source_dir/target" cargo build --release --locked --manifest-path "$source_dir/Cargo.toml"

stage=$(mktemp -d)
cleanup() {
  rm -rf "$stage"
}
trap cleanup EXIT

install -Dm755 "$source_dir/target/release/imm-native" "$stage/usr/bin/imm"
ln -s imm "$stage/usr/bin/imm-native"

install -d "$stage/DEBIAN"
cat > "$stage/DEBIAN/control" <<CONTROL
Package: $package
Version: $deb_version
Section: devel
Priority: optional
Architecture: $arch
Maintainer: susu3304 <noreply@github.com>
Depends: ca-certificates, libc6 (>= 2.35)
Homepage: https://github.com/susu3304/InsaneMarmotMatrixLanguage
Description: insane marmot matrix native runtime
 IMM is a small experimental language for matrix, coordinate, and board
 processing. This package installs the native CLI as /usr/bin/imm.
CONTROL

dpkg-deb --build --root-owner-group "$stage" "$out_dir/${package}_${deb_version}_${arch}.deb"
