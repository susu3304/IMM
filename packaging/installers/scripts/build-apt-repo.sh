#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "usage: $0 <deb-file> <version> [site-apt-dir]" >&2
  exit 64
fi

deb_file=$(cd "$(dirname "$1")" && pwd)/$(basename "$1")
version=$2
out_dir=${3:-site/apt}
codename=${APT_CODENAME:-stable}
component=${APT_COMPONENT:-main}
arch=${APT_ARCH:-amd64}

rm -rf "$out_dir"
mkdir -p "$out_dir/pool/main/i/imm" "$out_dir/dists/$codename/$component/binary-$arch"
cp "$deb_file" "$out_dir/pool/main/i/imm/"

(
  cd "$out_dir"
  dpkg-scanpackages --arch "$arch" pool /dev/null \
    > "dists/$codename/$component/binary-$arch/Packages"
  gzip -9c < "dists/$codename/$component/binary-$arch/Packages" \
    > "dists/$codename/$component/binary-$arch/Packages.gz"

  if command -v apt-ftparchive >/dev/null 2>&1; then
    apt-ftparchive \
      -o "APT::FTPArchive::Release::Origin=IMM" \
      -o "APT::FTPArchive::Release::Label=IMM" \
      -o "APT::FTPArchive::Release::Suite=$codename" \
      -o "APT::FTPArchive::Release::Codename=$codename" \
      -o "APT::FTPArchive::Release::Architectures=$arch" \
      -o "APT::FTPArchive::Release::Components=$component" \
      -o "APT::FTPArchive::Release::Description=IMM APT repository" \
      release "dists/$codename" > "dists/$codename/Release"
  else
    cat > "dists/$codename/Release" <<RELEASE
Origin: IMM
Label: IMM
Suite: $codename
Codename: $codename
Date: $(date -Ru)
Architectures: $arch
Components: $component
Description: IMM APT repository
RELEASE
  fi
)

if [ -n "${APT_GPG_PRIVATE_KEY:-}" ]; then
  gnupg_home=$(mktemp -d)
  export GNUPGHOME=$gnupg_home
  trap 'rm -rf "$gnupg_home"' EXIT

  printf '%s' "$APT_GPG_PRIVATE_KEY" | gpg --batch --import
  key_id=$(gpg --batch --list-secret-keys --with-colons | awk -F: '/^sec:/ { print $5; exit }')

  if [ -z "$key_id" ]; then
    echo "APT_GPG_PRIVATE_KEY did not contain a secret key" >&2
    exit 1
  fi

  gpg --batch --armor --export "$key_id" > "$out_dir/imm.asc"

  gpg_args=(--batch --yes --local-user "$key_id")
  if [ -n "${APT_GPG_PASSPHRASE:-}" ]; then
    gpg_args+=(--pinentry-mode loopback --passphrase "$APT_GPG_PASSPHRASE")
  fi

  (
    cd "$out_dir"
    gpg "${gpg_args[@]}" --clearsign \
      -o "dists/$codename/InRelease" "dists/$codename/Release"
    gpg "${gpg_args[@]}" -abs \
      -o "dists/$codename/Release.gpg" "dists/$codename/Release"
  )
else
  cat > "$out_dir/UNSIGNED_REPOSITORY.txt" <<EOF
This APT repository was generated without APT_GPG_PRIVATE_KEY.
Release artifacts are still available, but the APT repository should be signed
before it is used as the default install path.

Version: $version
EOF
fi
