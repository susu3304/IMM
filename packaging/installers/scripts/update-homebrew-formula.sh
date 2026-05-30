#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 5 ]; then
  echo "usage: $0 <release-tag> <version> <arm64-tarball> <x64-tarball> <formula-path>" >&2
  exit 64
fi

release_tag=$1
version=$2
arm64_tarball=$3
x64_tarball=$4
formula_path=$5
release_repository=${IMM_RELEASE_REPOSITORY:-susu3304/IMM}

arm64_sha=$(sha256sum "$arm64_tarball" | awk '{ print $1 }')
x64_sha=$(sha256sum "$x64_tarball" | awk '{ print $1 }')

mkdir -p "$(dirname "$formula_path")"

cat > "$formula_path" <<FORMULA
class Imm < Formula
  desc "Insane Marmot Matrix native runtime"
  homepage "https://github.com/susu3304/IMM"
  version "$version"
  license :cannot_represent

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/$release_repository/releases/download/$release_tag/imm-macos-arm64.tar.gz"
      sha256 "$arm64_sha"
    else
      url "https://github.com/$release_repository/releases/download/$release_tag/imm-macos-x64.tar.gz"
      sha256 "$x64_sha"
    end
  end

  def install
    bin.install "imm/bin/imm"
  end

  test do
    assert_match "insane marmot matrix native", shell_output("#{bin}/imm --version")
  end
end
FORMULA
