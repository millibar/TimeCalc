# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

TimeCalc is a calculator-style PWA for evaluating expressions that mix time durations (`H:MM`) and plain numbers — e.g. `1:30 + 3:45`, `40:00 / 7 * 31`. Built with Vite + React + TypeScript.

## Commands

- `npm run dev` — start the Vite dev server.
- `npm run build` — typecheck (`tsc -b`) and produce a production build in `dist/`.
- `npm run preview` — serve the production build locally.
- `npm test` — run the Vitest unit tests (`npm test -- --watch` to watch).
- `npm run lint` — run ESLint.

## Architecture

- `src/lib/timeCalc.ts` — the calculation engine: tokenizer, recursive-descent parser, and evaluator over a small typed `Value` union (`{ kind: 'time'; seconds }` or `{ kind: 'number'; value }`). Arithmetic rules are type-checked per operator (e.g. `time / time → number`, `time + number` is a `TimeCalcError`). Time is stored internally in seconds even though input/display is currently `H:MM`-only, so a future seconds-in-the-UI feature doesn't require touching the engine. Also has `formatTime`/`formatNumber` (result formatting, including the sub-minute-remainder flag) and `prettyFormula` (×/÷ display formatting).
- `src/lib/calculatorInput.ts` — a pure state machine (`applyButton(state, button) → state`) that builds up a formula string from calculator button presses, validating input as it goes (balanced parens, complete `H:MM` tokens, no implicit multiplication, unary minus, chaining a new expression off the previous result after `=`). Kept separate from `timeCalc.ts` so input UX logic and arithmetic semantics can be tested independently.
- `src/components/Calculator.tsx` — the button grid and display; renders the result with the sub-minute-remainder minutes underlined.
- Both `src/lib/*.ts` files have Vitest coverage (`*.test.ts`) exercising the worked examples from the spec (sign handling, mixed-type errors, division by zero, sub-minute rounding, etc.) and the button-input edge cases.
- PWA config (manifest, icons, service worker via `vite-plugin-pwa`) lives in `vite.config.ts`; icon source SVGs are not kept in the repo, only the generated PNGs under `public/icons/`.

## 開発ワークフロー

- 新しく機能を開発する際は、必ず新しいブランチを作成し、その中で作業すること。
- `master` ブランチに直接コミットしない。
- テストが通り、かつユーザーの確認が済んでから `master` ブランチにマージすること。

## Known limitations / future work

- Seconds input/display is intentionally not exposed in the UI yet (per spec), though the engine already carries sub-minute precision through calculations.
- Keyboard input is not implemented; button-only for now.

## Dev environment

- `.devcontainer/Dockerfile` — based on `mcr.microsoft.com/devcontainers/typescript-node:1-20-bookworm` (Node 20), with `ripgrep`, `curl`, `git`, and `@anthropic-ai/claude-code` installed globally.
- `.devcontainer/devcontainer.json` — mounts a shared `.claude` config directory from the host (`~/workspace/.claude`) into the container at `/workspace_shared/.claude`, then symlinks it to `./.claude` via `postCreateCommand`. It also mounts the host's `~/.claude.json` into the container. `postCreateCommand` also runs `npx -y playwright install --with-deps chromium` so the E2E setup below works out of the box, without adding `playwright`/`@playwright/test` to `package.json`.

## PlaywrightによるE2Eテスト

`playwright` / `@playwright/test` は `package.json` の依存関係には追加していない。ブラウザ本体（Chromium）は devcontainer 作成時に `postCreateCommand` の `npx -y playwright install --with-deps chromium` で一度だけダウンロード・キャッシュされる（`~/.cache/ms-playwright/`）ので、devcontainerが起動していればセットアップなしでE2E確認ができる。

### 基本の使い方（推奨・追加インストール不要）

`.mcp.json` に Playwright MCP サーバー（`@playwright/mcp`）を登録済み。`npm run dev` で開発サーバーを起動した状態で、Claude Codeに次のように依頼すると、Playwright MCP経由で実ブラウザ（Chromium）を操作して画面を確認できる。

```
npm run dev でサーバーを起動したので、Playwright MCPで http://localhost:5173/TimeCalc/ を開いて
「1:30 + 3:45」を入力し「=」を押した結果が 5:15 になることを確認して
```

`@playwright/mcp` は `npx -y @playwright/mcp@latest` として自前でPlaywright本体を解決するため、これも `package.json` へのインストールは不要。これが最も手軽で、`npm run dev` の実サーバーに対してボタン操作〜表示確認までを一通り検証できる。

- ボタンのラベルは全角の `：`（コロン）`−`（マイナス）`×`（かける）`÷`（わる）なので、要素を指定する際はそれに合わせること（半角の `:` `-` `*` `/` では見つからない）。

### スクリプトとして自動化したい場合

`npx playwright test` は `@playwright/test` が `node_modules` に無いと動かせず、`npx -p playwright ...` のようなその場限りのインストールでも `NODE_PATH` は通らないため `require`/`import` が解決できない（検証済み）。CIなどで繰り返し実行するテストを書くなら、素直に `npm install -D @playwright/test` して `package.json` に追加するのが最も確実。単発の動作確認だけなら、上記のPlaywright MCP経由でClaude Codeに直接操作してもらう方法で十分。

### 既知の注意点

- `@playwright/mcp` が依存する `playwright` のバージョンと、`postCreateCommand` の `npx -y playwright install` でダウンロードされるブラウザのバージョンがズレると、MCP経由の操作で `Executable doesn't exist` エラーになることがある（`@playwright/mcp` は先行版のPlaywrightに依存することがあるため）。その場合は `npx -y playwright install chromium` を再実行してブラウザキャッシュを最新化する。
- devcontainerのベースイメージは Debian 12 (bookworm) 。旧 Debian 11 (bullseye) では、最新のPlaywrightがChromiumのサポートを打ち切っており（`ERROR: Playwright does not support chromium on debian11-x64`）、`postCreateCommand` のブラウザインストールがそのままでは失敗するため bookworm に変更した。

### 申し送り（次回セッションへ）

- `feature/playwright-e2e` ブランチで、上記のPlaywright関連の変更（bookwormへのベースイメージ変更、`.mcp.json` のパッケージ名修正、本ドキュメントの追記）をコミット済み（コミット `a95235d`）。まだ `master` へはマージしていない。
- ここまでの動作確認は、旧bullseyeコンテナ上でPlaywrightを `1.49.1` に固定した場合の手動検証のみ（Chromiumダウンロード〜`install-deps`〜ブラウザ起動〜ボタン操作〜結果表示確認は成功）。**bookwormベースイメージでの動作はまだ未検証**（Dockerfileを書き換えても実行中のコンテナはリビルドされないため、このセッション内では確認できなかった）。
- ユーザーは「コンテナをリビルドしてから再開し、新しい環境でうまくいくか確認する」予定。次回セッション開始時は、以下を実施すること。
  1. リビルド後のコンテナが実際に bookworm ベースになっているか（`cat /etc/os-release`）を確認。
  2. `postCreateCommand` の `npx -y playwright install --with-deps chromium` が devcontainer 作成時に正常終了しているか（エラーなくChromiumがダウンロードされているか、`ls ~/.cache/ms-playwright/`）を確認。
  3. `npm run dev` を起動し、Playwright MCP（`.mcp.json` の `@playwright/mcp`）経由で実際に画面操作・確認ができるかを試す（上記「基本の使い方」の例を参照）。
  4. うまくいけば、この申し送り節の内容は削除してよい。うまくいかない場合は、発生したエラー内容に応じてこのファイルの記載を更新すること。
