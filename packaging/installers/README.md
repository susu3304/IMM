# IMM release packaging

This directory contains the packaging scripts used by the root `Release IMM`
workflow.

It builds the `crates/imm-native` Rust binary as the user-facing `imm` command
and publishes release assets from this integrated repository.

## Outputs

- `imm-windows-x64.msi`
- `imm-windows-x64.zip`
- `imm-winget-manifests.zip`
- `imm_<version>_amd64.deb`
- `imm-macos-arm64.tar.gz`
- `imm-macos-x64.tar.gz`
- `imm-vscode-<version>.vsix`
- APT repository metadata under GitHub Pages
- `homebrew-imm` formula update

## APT

The default APT URL is:

```bash
https://susu3304.github.io/InsaneMarmotMatrixLanguage/apt
```

Install command:

```bash
sudo install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://susu3304.github.io/InsaneMarmotMatrixLanguage/apt/imm.asc | sudo tee /etc/apt/keyrings/imm.asc >/dev/null
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/imm.asc] https://susu3304.github.io/InsaneMarmotMatrixLanguage/apt stable main" | sudo tee /etc/apt/sources.list.d/imm.list
sudo apt update
sudo apt install imm
```

## Homebrew

The Homebrew tap remains a separate repository:

```bash
brew tap susu3304/imm
brew install imm
```

The release workflow updates `Formula/imm.rb` in `susu3304/homebrew-imm` using
the macOS tarball URLs and sha256 values from the same GitHub Release.

Required secret:

- `HOMEBREW_TAP_DEPLOY_KEY`: SSH private deploy key with write access to
  `susu3304/homebrew-imm`.

## Signing

Required for signed APT metadata:

- `APT_GPG_PRIVATE_KEY`: ASCII-armored private GPG key used to sign `Release`.
- `APT_GPG_PASSPHRASE`: optional passphrase for that key.

If the signing key is missing, `.deb`, MSI, tarball, and VSIX assets are still
created, but the APT repository is emitted unsigned.
