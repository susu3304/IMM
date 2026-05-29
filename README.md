# IMM Monorepo

IMM runtime、Web runner、VS Code拡張、installer/release automationをまとめる統合repoです。

## Layout

- `crates/imm-native`: Rust IMM runtime and CLI.
- `apps/imm-web`: IMM Web UI and local runner API.
- `editors/vscode/imm`: VS Code language extension.
- `packaging/installers`: release packaging scripts.
- `homebrew-imm`: external Homebrew tap updated by the release workflow.
- `docs/architecture.md`: integration architecture and next split plan.

## Development

```bash
cargo test --locked -p imm-native
cargo run -p imm-native -- law
```

```bash
cd apps/imm-web
npm install
npm run build
npm run smoke
```

```bash
cd editors/vscode/imm
npm test
npm run package
```

## Release

Runtime version is controlled by `crates/imm-native/Cargo.toml`.

Create a `vX.Y.Z` tag matching that version, or run the `Release IMM` workflow manually. The release workflow builds native artifacts, VSIX, APT metadata, and updates the external Homebrew tap when `HOMEBREW_TAP_DEPLOY_KEY` is configured.
