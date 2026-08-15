# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

TimeCalc is a calculator-style PWA for evaluating expressions that mix time durations (`H:MM`) and plain numbers — e.g. `1:30 + 3:45`, `40:00 / 7 * 31`. Built with Vite + React + TypeScript.

## 外部仕様書

- ユーザーから見た振る舞い（画面構成、ボタン操作、入力ルール、計算ルール、表示形式、エラー表示など）は @docs/spec.md に定義されている。実装の詳細（コード構成）はこのファイルの「Architecture」節を参照。
- **機能を追加する、または既存の仕様を変更する場合は、まず @docs/spec.md にその変更を反映し、ユーザーの承認を得てから実装に進むこと。** 実装を先に進めてはならない。

## Commands

- `npm run dev` — start the Vite dev server.
- `npm run build` — typecheck (`tsc -b`) and produce a production build in `dist/`.
- `npm run preview` — serve the production build locally.
- `npm test` — run the Vitest unit tests (`npm test -- --watch` to watch).
- `npm run lint` — run ESLint.
- `npm run test:e2e` — run the Playwright E2E tests (`e2e/calculator.spec.ts`) headless against a real Chromium; auto-starts `npm run dev` if it isn't already running (see `playwright.config.ts`).

## Architecture

- `src/lib/timeCalc.ts` — the calculation engine: tokenizer, recursive-descent parser, and evaluator over a small typed `Value` union (`{ kind: 'time'; seconds }` or `{ kind: 'number'; value }`). Arithmetic rules are type-checked per operator (e.g. `time / time → number`, `time + number` is a `TimeCalcError`). Time is stored internally in seconds even though input/display is currently `H:MM`-only, so a future seconds-in-the-UI feature doesn't require touching the engine. Also has `formatTime`/`formatNumber` (result formatting, including the sub-minute-remainder flag), `prettyFormula` (×/÷ display formatting), `prettyCursorIndex` (raw formula cursor position → position in the pretty-formatted display string) and its inverse `formulaIndexFromPrettyIndex` (used to resolve a tap on the display back to a formula cursor position).
- `src/lib/calculatorInput.ts` — a pure state machine (`applyButton(state, button) → state`) that builds up a formula string from calculator button presses, validating input as it goes (balanced parens, complete `H:MM` tokens, no implicit multiplication, unary minus, chaining a new expression off the previous result after `=`). Kept separate from `timeCalc.ts` so input UX logic and arithmetic semantics can be tested independently. The `setCursor` button lets any caller (keyboard nav, or a tap on the formula display) jump the cursor to an arbitrary position directly.
- `src/components/Calculator.tsx` — the button grid and display; renders the result with the sub-minute-remainder minutes underlined. Tapping/clicking the formula display moves the cursor to that point: it resolves the click via `document.caretRangeFromPoint`/`caretPositionFromPoint` (with a `Range`-based DOM-to-text-offset trick that works across the before/cursor/after `<span>`s), converts that pretty-string offset to a formula index with `formulaIndexFromPrettyIndex`, and dispatches a `setCursor` button press. Since jsdom doesn't implement `caretRangeFromPoint`/`caretPositionFromPoint`, this DOM glue isn't covered by component tests — only the pure `formulaIndexFromPrettyIndex` mapping is (in `timeCalc.test.ts`); the DOM wiring itself was checked manually via Playwright MCP.
- Both `src/lib/*.ts` files have Vitest coverage (`*.test.ts`) exercising the worked examples from the spec (sign handling, mixed-type errors, division by zero, sub-minute rounding, etc.) and the button-input edge cases.
- PWA config (manifest, icons, service worker via `vite-plugin-pwa`) lives in `vite.config.ts`; icon source SVGs are not kept in the repo, only the generated PNGs under `public/icons/`.

## 開発ワークフロー

- 機能追加・仕様変更を行う際は、まず「外部仕様書」節の手順に従って @docs/spec.md を更新し、ユーザーの承認を得ること。承認前に実装を始めない。
- 新しく機能を開発する際は、必ず新しいブランチを作成し、その中で作業すること。
- `master` ブランチに直接コミットしない。
- テストが通り、かつユーザーの確認が済んでから `master` ブランチにマージすること。

## Known limitations / future work

- Seconds input/display is intentionally not exposed in the UI yet (per spec), though the engine already carries sub-minute precision through calculations.
- Keyboard input is not implemented; button-only for now.

## Dev environment

- `.devcontainer/Dockerfile` — based on `mcr.microsoft.com/devcontainers/typescript-node:1-20-bookworm` (Node 20), with `ripgrep`, `curl`, `git`, and `@anthropic-ai/claude-code` installed globally.
- `.devcontainer/devcontainer.json` — mounts a shared `.claude` config directory from the host (`~/workspace/.claude`) into the container at `/workspace_shared/.claude`, then symlinks it to `./.claude` via `postCreateCommand`. It also mounts the host's `~/.claude.json` into the container. `postCreateCommand` also runs `npx -y playwright install --with-deps chromium` so the E2E setup below (both `npm run test:e2e` and Playwright MCP) works out of the box without a separate browser install step.

## PlaywrightによるE2Eテスト

`@playwright/test` は `package.json` の devDependencies に追加済み。ブラウザ本体（Chromium）は devcontainer 作成時に `postCreateCommand` の `npx -y playwright install --with-deps chromium` で一度だけダウンロード・キャッシュされる（`~/.cache/ms-playwright/`）ので、devcontainerが起動していればセットアップなしでE2Eが実行できる。

### `npm run test:e2e`（自動実行・推奨）

`e2e/calculator.spec.ts` に、docs/spec.md（外部仕様書）の内容に沿ったシナリオを `@playwright/test` 形式のテストコードとして書いてある。`npm run test:e2e`（`playwright test`）でヘッドレスのChromiumに対して実行できる。`playwright.config.ts` の `webServer` 設定により、`npm run dev` が起動していなければ自動起動し（起動済みならそれを再利用する）、`http://localhost:5173/TimeCalc/` に対してテストする。

- Vitest（`npm test`）はこのファイルを実行しない。`e2e/calculator.spec.ts` は `spec.ts` という名前でVitestのデフォルト対象パターンにも一致してしまうため、`vite.config.ts` の `test.exclude` で明示的に除外している（`@playwright/test` の `test()` はVitestのAPIと非互換のため、除外を外してはいけない）。
- 機能を追加・変更したら、対応するシナリオをこのファイルにも追記し、`npm run test:e2e` で通ることを確認すること。
- `.github/workflows/ci.yml` により、`master` への push と pull request のたびに `npm run lint` → `npm test` → `npm run build` → `npm run test:e2e`（Chromium）が自動実行される。`playwright.config.ts` は `process.env.CI` を見て、CI上ではレポーターを `github`（ログにインライン注釈）+ `html`（失敗時にアーティファクトとしてアップロード）に切り替え、リトライを1回有効にする。デプロイ用の `.github/workflows/deploy.yml` とは別ワークフローで、デプロイ自体はCIの成否をブロッキングでは待たない。

### Playwright MCPでの手動確認（探索的な確認・スクリーンショット向け）

`.mcp.json` に Playwright MCP サーバー（`@playwright/mcp`）を登録済み。`npm run dev` で開発サーバーを起動した状態で、Claude Codeに次のように依頼すると、Playwright MCP経由で実ブラウザ（Chromium）を操作して画面を確認できる。

```
npm run dev でサーバーを起動したので、Playwright MCPで http://localhost:5173/TimeCalc/ を開いて
「1:30 + 3:45」を入力し「=」を押した結果が 5:15 になることを確認して
```

- ボタンのラベルは全角の `：`（コロン）`−`（マイナス）`×`（かける）`÷`（わる）なので、要素を指定する際はそれに合わせること（半角の `:` `-` `*` `/` では見つからない）。
- 定型的な回帰確認は `npm run test:e2e` に任せ、MCPはUIを実際に目で見て確認したい場合（スクリーンショット、新機能の探索的な動作確認など）に使う。

### 既知の注意点

- **この devcontainer には X サーバーが無く、Playwright MCP はデフォルトでheadedモードのChromeを起動しようとするため、`Missing X server or $DISPLAY` で失敗する（2026-08-15確認）。** MCP経由の画面確認をしたい場合は、Xサーバーの用意（`xvfb-run` 等）が必要。一方 `npx playwright test`（`npm run test:e2e`）はデフォルトでheadless実行のため、Xサーバーが無くても問題なく動く——CIや自動テストにはこちらを使う。
- `@playwright/mcp` が依存する `playwright` のバージョンと、`postCreateCommand` の `npx -y playwright install` でダウンロードされるブラウザのバージョンがズレると、MCP経由の操作で `Executable doesn't exist` エラーになることがある（`@playwright/mcp` は先行版のPlaywrightに依存することがあるため）。その場合は `npx -y playwright install chromium` を再実行してブラウザキャッシュを最新化する。
- devcontainerのベースイメージは Debian 12 (bookworm) 。旧 Debian 11 (bullseye) では、最新のPlaywrightがChromiumのサポートを打ち切っており（`ERROR: Playwright does not support chromium on debian11-x64`）、`postCreateCommand` のブラウザインストールがそのままでは失敗するため bookworm に変更した。
- 新しいdevcontainerでは、`.mcp.json` に登録したプロジェクトスコープのMCPサーバー（`playwright`）が初回は未承認（`⏸ Pending approval`）状態になっていることがある。`claude mcp list` で確認でき、ペンディングのままだとそのセッションではPlaywright MCPのツールが使えない。承認は対話的な起動時プロンプトで行われ、一度承認すれば `~/.claude.json`（ホストの `~/.claude.json` がマウントされているため永続化される）に記録され、以後のセッションでは再度聞かれない。

bookwormベースイメージ・Playwright MCP経由でのE2E動作確認済み（コミット `a95235d` の内容で、`1:30 + 3:45` → `=` → `5:15` の表示確認まで成功）。

2026-08-14: `e2e/calculator.spec.ts` の各シナリオをPlaywright MCP（実Chromium）で1つずつ動作確認した上でテストコード化。

2026-08-15: `npm install -D @playwright/test` を実施し、`playwright.config.ts` を追加。`e2e/calculator.spec.ts` を docs/spec.md の内容に沿って書き直し、`npm run test:e2e`（ヘッドレスChromium、41シナリオ）で全件パスすることを確認済み。

2026-08-15: `.github/workflows/ci.yml` を追加し、lint・ユニットテスト・ビルド・E2Eテストを push / pull_request で自動実行するようにした。`CI=true npm run test:e2e` をローカルでも実行し、41件全てパス・`github`/`html` レポーターが正しく機能することを確認済み。
