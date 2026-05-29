# IMM / NKMZ Integration Plan

作成日: 2026-05-29

## 現状整理

対象repo:

- `nkmzapi`: Bun + Hono API。OpenAPI生成、Postgres migrations、SSH deploy。
- `nkmzweb`: Next.js Web UI。`NEXT_PUBLIC_API_BASE_URL` で `nkmzapi` に接続。
- `nkmzbot`: Go Discord bot。`nkmzapi` をBot tokenで叩き、IMMは現在ローカルCLI実行。
- `InsaneMarmotMatrixLanguage`: Rust IMM runtime。ローカル実体は `/Users/susu/Documents/New project 2`。`editors/vscode/imm` も含む。
- `imm-installers`: runtimeをcheckoutしてdeb/MSI/macOS tarball/VSIXを作り、Homebrew tapも更新。
- `imm-web-runner`: IMMサイト、ローカル実行API、Cloudflare static/Worker公開。Cloudflare上では実行APIは無効。
- `homebrew-imm`: Homebrew tap。実体は配布先として必要だが、開発repoではなく生成結果に寄せるべき。
- `imm-vscode`: standalone VS Code extension。runtime repo内の `editors/vscode/imm` と重複し、内容も分岐済み。

補足:

- ユーザー記載の `homeebrew-imm` はローカルでは `homebrew-imm`。
- `/Users/susu/develop/insane/marmot` はDiscordメッセージ取得用Rust projectで、IMM runtimeではない。

## 方針決定案

8repoを1つの巨大monorepoにはしない。製品境界で2系統に分ける。

1. IMM系は「runtime repo」と「web/API repo」の2本に寄せる。
2. NKMZ系は別系統として、まずAPI契約とDB migrationの所有権を整理し、その後monorepo化する。
3. `homebrew-imm` はHomebrew tapの慣習上、外部repoとして残す。ただし人が編集する開発repoではなく、release workflowが更新する生成先にする。

最終形:

```text
InsaneMarmotMatrixLanguage  または imm
  crates / src: runtime, CLI, wasm target
  editors/vscode/imm: VS Code extension
  packaging: deb, MSI, macOS tarball, winget, Homebrew formula generator
  .github/workflows: test, release, tap update, web refresh dispatch

imm-web-runner  または imm-web
  web UI
  browser wasm runner
  hosted runtime API
  Cloudflare/static deploy

homebrew-imm
  generated tap only

nkmz
  apps/api
  apps/web
  apps/bot
  shared API/client generation and deployment glue
```

## IMM統合計画

### Phase 1: runtime repoを唯一の正にする

- `InsaneMarmotMatrixLanguage` をcanonical repoにする。
- standalone `imm-vscode` の差分を `editors/vscode/imm` へ取り込む。
- VSIXやbuild artifactをrepoから除外し、release assetだけにする。
- `imm-installers/scripts` とworkflowをruntime repoの `packaging/` と `.github/workflows/release.yml` へ移す。
- `Cargo.toml` versionをruntime/CLI releaseの唯一の正にする。
- VS Code extension versionは独立でもよいが、runtime releaseに同梱する場合はrelease notesで対応runtimeを明記する。

### Phase 2: releaseを一本化する

runtime repoのtagまたはmanual workflowで次を一括生成する。

- Linux `.deb` とAPT repo
- Windows MSIまたはportable zip、winget manifests
- macOS arm64/x64 tarball
- VS Code `.vsix`
- GitHub Release
- `homebrew-imm` formula更新
- `imm-web` 側のdownload/runtime metadata refresh

`imm-installers` は移行後にREADME redirectを置いてarchive候補にする。
`imm-vscode` も同様に、marketplace公開が必要な場合だけ配布元として残す。

### Phase 3: wasm対応

いきなり全runtimeをwasmにするのではなく、Rust crateを分ける。

- `imm-core`: lexer/parser/checker/evaluator、純粋なstdlib。OS/network/processに依存しない。
- `imm-cli`: CLI、filesystem、native network、pack、server系を担当。
- `imm-wasm`: `wasm32-unknown-unknown` / `wasm-bindgen` で `check`, `fmt`, `run`, `spec` を公開。

最初のwasm対象:

- `check`
- `fmt`
- pureな `run`
- `spec --json`
- examples/lawのwasm対応サブセット

後回しまたはcapability扱い:

- `web.grab` / `web.fetch`
- `web.den` server
- `store`
- `pack`
- filesystemやnetworkを要求する機能

`imm-web` はwasm runnerを第一候補にし、native専用機能だけhosted APIへfallbackする。

### Phase 4: IMM runtime API

`imm-web` 側にAPIとして提供する。

初期endpoint:

- `GET /api/imm/spec`
- `POST /api/imm/check`
- `POST /api/imm/fmt`
- `POST /api/imm/run`

実装方針:

- 最初は既存のNode/Express runnerでnative `imm` をsandbox実行。
- timeout、source/output byte limit、一時dir、network deny、rate limitを必須にする。
- request/response schemaをOpenAPI化する。
- 後でRust `axum` などのnative API serviceへ置き換えられるよう、HTTP contractを先に固定する。

NKMZ botは将来的に `IMM_BINARY` 直接実行だけでなく、`IMM_RUNNER_MODE=api` を持てるようにする。

## NKMZ統合計画

NKMZはIMMとは別productとして扱う。

### Phase 1: 契約とDB所有権を整理

- `nkmzapi` のOpenAPIを唯一のAPI契約にする。
- `nkmzweb` はOpenAPIからTS client/typesを生成する。
- `nkmzbot` はOpenAPIからGo clientを生成する、または薄い手書きclientをOpenAPIに合わせてテストする。
- DB migrationsは原則 `nkmzapi` が所有する。bot側に残るmigrationsはAPIへ移すか、明確にbot-local tablesとして分離する。

### Phase 2: monorepo化

`nkmz` repoへ移す場合の構成:

```text
apps/api
apps/web
apps/bot
infra/docker
infra/migrations
packages/api-client-ts
tools
```

言語はBun/Node/Go混在のままでよい。共通化するのはbuild orchestration、OpenAPI、deploy順序、docker compose。

### Phase 3: IMM連携更新

- `nkmzbot` に `local` / `api` のIMM runner modeを追加する。
- productionではIMM APIを使い、障害時だけローカルCLI fallbackを検討する。
- `nkmzapi` は必要ならIMM command validation APIを呼べるようにする。

## 推奨作業順

1. `InsaneMarmotMatrixLanguage` に統合用branchを作る。
2. `imm-vscode` 差分をruntime repo内extensionへ統合し、extensionテストを通す。
3. `imm-installers` workflow/scriptsをruntime repoへ移植し、manual release dry-runを通す。
4. `homebrew-imm` 更新をruntime release workflowから行えるようにする。
5. `imm-web-runner` のrelease参照先を新runtime releaseへ切り替える。
6. `imm-core` / `imm-cli` / `imm-wasm` のcrate分割を行い、wasm最小APIを作る。
7. `imm-web-runner` にwasm runnerを追加する。
8. hosted IMM runtime APIをOpenAPIつきで固定する。
9. `nkmzbot` にIMM API runner modeを追加する。
10. NKMZ側のOpenAPI client生成とmigration所有権整理を行う。
11. NKMZ monorepo化は最後に行う。先に契約を固める。

## 残るリスク

- VS Code extensionはruntime repo内版とstandalone版が分岐しているため、統合時に機能差分レビューが必要。
- Homebrew tapは別repo維持が実務上自然。完全に1repoへ閉じるとHomebrew利用体験が悪くなる。
- wasm化はruntimeのOS依存機能を分離しないと詰まる。先にcrate境界を切る必要がある。
- Cloudflare Workers上でnative実行はできない。Cloudflareではstatic + wasm、native実行は別hosted APIという前提にする。
- NKMZはDBをAPIとbotがまたいでいるため、monorepo化より先にmigration所有権を決める必要がある。
