#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 3 ]; then
  echo "usage: $0 <imm-source-dir> [out-dir] [extension-dir]" >&2
  exit 64
fi

source_dir=$(cd "$1" && pwd)
out_dir=${2:-dist}
if [ "$#" -ge 3 ]; then
  extension_dir=$(cd "$3" && pwd)
elif [ -n "${IMM_VSCODE_EXTENSION_DIR:-}" ]; then
  extension_dir=$(cd "$IMM_VSCODE_EXTENSION_DIR" && pwd)
else
  extension_dir="$source_dir/editors/vscode/imm"
fi

if [ ! -f "$extension_dir/package.json" ]; then
  echo "VS Code extension package.json not found: $extension_dir/package.json" >&2
  exit 1
fi

mkdir -p "$out_dir"
out_dir=$(cd "$out_dir" && pwd)
version=$(node -p "require(process.argv[1]).version" "$extension_dir/package.json")
out_file="$out_dir/imm-vscode-${version}.vsix"

(
  cd "$extension_dir"
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
  npm test
  npm run package:vsix -- --out "$out_file"
)
