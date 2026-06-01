# IMM Architecture

このrepoでは、IMMを「言語本体」「native実行基盤」「入口」「配布」に分けて扱う。

```text
imm-core      current: lexer/parser/checker/fmt/eval/spec
imm-native    current: native CLI, filesystem, network, store, pack, release binary
imm-wasm      current: browser-safe binding for imm-web
imm-api       future: authenticated native HTTP execution service
imm-web       current: public site, browser WASM runner, local native runner API
vscode        current: editor integration
packaging     current: release artifacts and Homebrew synchronization
```

## 現在の配置

- `crates/imm-core`: OS非依存の言語本体。lexer/parser/checker/evaluator、formatter、specを持つ。
- `crates/imm-native`: native CLI/runtime。filesystem、native network、server、store、packを担当する。
- `crates/imm-wasm`: `wasm32-unknown-unknown` / `wasm-bindgen` binding。`check`、`fmt`、pureな `run`、`spec` を公開する。
- `apps/imm-web`: Web UI。公開環境ではbrowser WASM runnerを使い、ローカルではnative runner APIも選べる。
- `editors/vscode/imm`: VS Code拡張。runtime repo内の新しい版を正として配置している。
- `packaging/installers`: deb、MSI、macOS tarball、APT repo、VSIX、Homebrew formula更新用script。
- `homebrew-imm`: 正式なtap repoは別repoのまま維持し、このrepoのrelease workflowから更新する。

## 実行境界

- browser WASM: `check`、`fmt`、pureな `run`、`spec`。`web.grab` は `data:` URLのみ扱える。
- native CLI/API: filesystem、external network、web server、store、pack、law/probe。
- future hosted API: API keyつきでnative capabilityを限定公開し、`imm-web` からfallbackできるようにする。

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
