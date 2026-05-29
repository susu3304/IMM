# IMM Web Runner

IMM のサイト兼ローカル Web Runner です。エディタは IMM 用のシンタックスハイライトを持ち、ローカル起動時はバックエンドが `imm-native` を一時ディレクトリ内で実行します。Cloudflare へは実行 API なしの Workers Static Assets + Worker として公開できます。

含まれるもの:

- IMM Web Runner
- 直接表示されるインストールコマンド
- GitHub Releases asset から取得した直接ダウンロードリンク
- ページ内に直接表示される言語ドキュメント
- VS Code 拡張 `.vsix` の直接ダウンロード
- GitHub Releases から取得するランタイム一覧とランタイム選択

## 起動

```bash
cd /Users/susu/Documents/imm-web-runner
npm install
npm run dev
```

ブラウザで <http://127.0.0.1:5173> を開きます。API は <http://127.0.0.1:8787> で動きます。

デフォルトでは統合repo内の `../../crates/imm-native` を探し、`target/debug/imm-native` または `target/release/imm-native` を使います。未ビルドの場合は初回実行時に `cargo build --bin imm-native` を走らせます。

ランタイム一覧は `susu3304/InsaneMarmotMatrixLanguage` の GitHub Releases から取得します。現在の OS / CPU で実行できる tarball があるリリースは、選択すると `.runtime-cache/` にダウンロードして実行できます。

ダウンロード表示は `/api/downloads` から取得します。IMM インストーラと VS Code 拡張は、既定で `susu3304/InsaneMarmotMatrixLanguage` の latest release を参照します。VS Code 拡張は latest release 内の `imm-vscode-*.vsix` asset を選び、`/downloads/vscode/latest.vsix` から直接取得できます。

別の IMM 実行ファイルを使う場合:

```bash
IMM_NATIVE_BIN=/path/to/imm-native npm run dev
```

別の IMM リポジトリを使う場合:

```bash
IMM_REPO_DIR=/path/to/imm-repo npm run dev
```

ランタイム一覧に別の release API を使う場合:

```bash
IMM_INSTALLER_RELEASES_URL=https://api.github.com/repos/owner/repo/releases?per_page=20 npm run dev
```

Install / VS Code 表示に別の latest release API を使う場合:

```bash
IMM_INSTALLER_LATEST_URL=https://api.github.com/repos/owner/repo/releases/latest npm run dev
```

## サンドボックス

実行時の制約:

- IMM ソースは 64KB まで。
- 実行ごとに 0700 の一時ディレクトリを作成し、`main.imm` を 0600 で保存。
- `cwd`、`HOME`、`TMPDIR` を一時ディレクトリへ固定。
- shell は使わず、stdin は閉じる。
- 環境変数は最小限だけ渡す。
- 既定タイムアウトは 3000ms、最大 8000ms。
- stdout / stderr は各 64KB で打ち切り。
- タイムアウトや出力超過時はプロセスグループごと停止。
- macOS で `/usr/bin/sandbox-exec` が使える場合は実行ファイルを一時ディレクトリへコピーしてから OS サンドボックスを使い、書き込みを一時ディレクトリへ制限し、ユーザーホーム配下の読み取りと network を deny します。

`sandbox-exec` がない環境では process-boundary にフォールバックします。その場合も一時ディレクトリ・タイムアウト・出力上限は有効ですが、OS レベルの network deny はありません。

## 検証

```bash
npm run build
npm run smoke
```

`npm run smoke` は通常実行、ホーム配下への書き込み拒否、タイムアウト停止を確認します。

## Cloudflare Deploy

Cloudflare Workers Static Assets へ、実行機能なしのサイトとして公開します。Worker は `/api/downloads`、`/api/vscode-extension`、`/api/runtimes` を提供し、latest release から配布情報を返します。

```bash
cd /Users/susu/Documents/imm-web-runner
npm install
npm run build
npx wrangler login
npm run deploy:cf
```

ログイン済みなら次だけで公開できます。

```bash
npm run deploy:cf
```

GitHub Actions から公開する場合は、`imm-web-runner` リポジトリに以下の secrets を追加してください。

- `CLOUDFLARE_API_TOKEN`: Workers Scripts Edit / Workers Routes Edit 相当の権限を持つ API token
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account id

その後、Actions の `Deploy IMM Web` workflow を手動実行するか、`main` へ push すると deploy されます。

設定は `wrangler.jsonc` にあります。

- `assets.directory`: `./dist/client`
- `assets.not_found_handling`: `single-page-application`
- `assets.run_worker_first`: `/api/*` と `/downloads/vscode/latest.vsix`
- VS Code 拡張 VSIX: `susu3304/InsaneMarmotMatrixLanguage` の latest release にある `imm-vscode-*.vsix`
- APT repository URL: 既定は `https://susu3304.github.io/InsaneMarmotMatrixLanguage/apt`

Cloudflare 上では `/api/run` / `/api/check` は使いません。Worker は 501 を返し、ページ側は実行ボタンを無効化します。Install / Docs / Downloads は Worker API から latest release を表示し、API が使えない場合だけ静的フォールバックを表示します。

## Repository Layout

現時点の分離方針:

- Runtime / Installers / VS Code extension: `susu3304/InsaneMarmotMatrixLanguage`
- Homebrew tap: `susu3304/homebrew-imm`
- Site / Web Runner: this repository

ランタイムの実行バージョンは installer release tag と source commit で追跡し、VS Code 拡張は独立した semver tag でリリースします。
