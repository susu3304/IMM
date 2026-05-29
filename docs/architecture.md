# IMM Architecture

このrepoでは、IMMを「言語本体」「native実行基盤」「入口」「配布」に分けて扱う。

```text
imm-core      future: lexer/parser/checker/fmt/eval/spec
imm-native    current: Rust runtime crate and CLI binary
imm-wasm      future: browser-safe binding for imm-web
imm-api       future: authenticated native HTTP execution service
imm-web       current: public site and runner UI
vscode        current: editor integration
packaging     current: release artifacts and Homebrew synchronization
```

## 現在の配置

- `crates/imm-native`: Rust runtime crate。現時点では言語本体とCLIが同居している。
- `apps/imm-web`: Web UI。公開環境ではstatic/Worker、ローカルではnative runner APIも起動できる。
- `editors/vscode/imm`: VS Code拡張。runtime repo内の新しい版を正として配置している。
- `packaging/installers`: deb、MSI、macOS tarball、APT repo、VSIX、Homebrew formula更新用script。
- `homebrew-imm`: 正式なtap repoは別repoのまま維持し、このrepoのrelease workflowから更新する。

## 次の分割方針

1. `crates/imm-native` からOS非依存の処理を `crates/imm-core` へ移す。
2. CLI、filesystem、network、server、store、packをnative層に残す。
3. `crates/imm-wasm` を追加し、`check`、`fmt`、pureな `run`、`spec` だけを公開する。
4. `apps/imm-web` は通常WASMで実行し、API keyがある場合だけremote API runnerを使う。
5. `apps/imm-api` または同等のserviceを追加し、閉じた環境でnative機能をcapability制御つきで動かす。

## Release同期

`crates/imm-native/Cargo.toml` のpackage versionをruntime releaseの唯一の正にする。

`vX.Y.Z` tagまたはmanual release workflowで次を同時に作る。

- GitHub Release
- macOS arm64/x64 tarball
- Windows MSI
- Linux deb
- APT repository metadata
- VS Code VSIX
- `homebrew-imm` の `Formula/imm.rb` 更新

Homebrew tapは別repoのままにするが、手動でversionやsha256を編集しない。release workflowがtarballのsha256を計算し、同じ`vX.Y.Z`へ同期する。
