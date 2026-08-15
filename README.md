# TimeCalc

電卓のように、時間数（`H:MM`、秒まで含める場合は`H:MM:SS`）を含む数式を入力して計算できるPWAアプリです。

ユーザーから見た振る舞い（画面構成・操作・計算ルール・表示形式など）の詳細な仕様は [`docs/spec.md`](docs/spec.md) を参照してください。

例:

```
1:30 + 3:45   = 5:15
2:59 - 3:00   = -0:01
0:15 * 4      = 1:00
3:00 / 2      = 1:30
1:00 / 0:15   = 4
40:00 / 7 * 31 = 177:08:34 （秒未満の端数あり）
1:30:00 + 0:00:45 = 1:30:45
```

## 主な機能

- 電卓風のボタンUIで数式を入力（数字・`:`（1つの値に最大2つまで、`H:MM`または`H:MM:SS`）・`+ − × ÷`・`( )`・`=`・`AC`・`⌫`）
- 数式表示エリアをタップ（クリック）すると、その位置にカーソルを移動できる
- 時間数と数値が混在する式に対応し、演算子ごとに以下の型規則で計算
  - `時間 ± 時間 → 時間`
  - `時間 × 数値` / `数値 × 時間 → 時間`
  - `時間 ÷ 数値 → 時間`
  - `時間 ÷ 時間 → 数値`
  - `数値 ± 数値` / `数値 × 数値` / `数値 ÷ 数値 → 数値`
  - 上記以外の組み合わせ（例: `時間 + 数値`）はエラー
- 括弧による優先順位の指定、単項マイナスに対応
- 負の時間数は `-0:01` のように符号付きで表示
- 表示は秒成分が0なら `H:MM` 形式、秒成分があれば `H:MM:SS` 形式（時は24で折り返さない、経過時間としての表示）
- 内部計算は秒単位で保持しており、結果に秒未満の端数が残る場合は秒の部分に下線を表示
- PWA対応（マニフェスト・アイコン・Service Workerによるオフラインキャッシュ）
- 縦長のスマホ画面に最適化したレイアウト
  - 入力ボタン（キーパッド）は画面の横幅いっぱいに広がり、その横幅を基準にボタンの縦の長さが決まる
  - 画面の残りの縦スペースはすべて数式・結果の表示エリアに使われる
  - 数式が長くなった場合は折り返して複数行で表示

## 今後の対応（未実装）

- キーボードからの数式入力

## 技術スタック

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)（PWA化）
- [Vitest](https://vitest.dev/)（ユニットテスト）

## セットアップ

```bash
npm install
```

## 開発

```bash
npm run dev       # 開発サーバーを起動
npm run build     # 型チェック + 本番ビルド（dist/ に出力）
npm run preview   # 本番ビルドをローカルで確認
npm test          # ユニットテストを実行
npm run lint      # ESLint を実行
npm run test:e2e  # E2Eテスト（Playwright）を実行
```

## E2Eテスト（Playwright）

`@playwright/test` を依存関係として追加済み。devcontainer利用時は `postCreateCommand` でChromiumがあらかじめキャッシュされているため、追加インストールなしでE2Eが実行できる。

```bash
npm run test:e2e
```

[`playwright.config.ts`](playwright.config.ts) の設定により、開発サーバーが起動していなければ自動的に `npm run dev` を起動する（起動済みならそれを再利用する）。テストシナリオは [`docs/spec.md`](docs/spec.md)（外部仕様書）の内容に沿って [`e2e/calculator.spec.ts`](e2e/calculator.spec.ts) にまとめてあり、ヘッドレスのChromiumに対して実行される。

新しい機能を追加したときは、このファイルにもシナリオを追記すること。

### Playwright MCPでの手動確認

自動テストとは別に、Claude Codeに画面を実際に操作・確認してもらいたい場合（探索的な確認やスクリーンショットなど）は、Playwright MCP（`.mcp.json` に設定済み）も利用できる。

```
npm run dev でサーバーを起動したので、Playwright MCPで http://localhost:5173/TimeCalc/ を開いて
「1:30 + 3:45」を入力し「=」を押した結果が 5:15 になることを確認して
```

ボタンのラベルは全角の `：` `−` `×` `÷` なので、要素を指定する際は半角記号ではなくこちらを使う（詳細は [`CLAUDE.md`](CLAUDE.md) を参照）。

## CI

`master` への push と pull request のたびに、GitHub Actions（[`.github/workflows/ci.yml`](.github/workflows/ci.yml)）が以下を自動実行します。

1. `npm run lint`
2. `npm test`（ユニットテスト）
3. `npm run build`
4. `npm run test:e2e`（Playwright E2Eテスト）

失敗時はPlaywrightのHTMLレポートがアーティファクトとしてアップロードされます。

## デプロイ

`master` ブランチに push すると、GitHub Actions（[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)）が自動的に以下を実行し、GitHub Pages に公開します。

1. `npm ci` で依存関係をインストール
2. `npm run build` でビルド（`dist/` を生成）
3. `dist/` を GitHub Pages にデプロイ

公開URL: https://millibar.github.io/TimeCalc/

- GitHub側の設定は Pages のソースを「GitHub Actions」にしてあります（リポジトリの Settings → Pages）。
- `vite.config.ts` の `base` をリポジトリ名に合わせて `/TimeCalc/` に設定しており、PWAマニフェストの `start_url` / `scope` もこのサブパスに合わせています。リポジトリ名を変更した場合はここも合わせて変更が必要です。
- デプロイ状況は `gh run list` や `gh run watch <run-id>`、またはリポジトリの Actions タブから確認できます。
- 手動での再実行は Actions タブの workflow_dispatch、または `gh workflow run deploy.yml` から行えます。

## アーキテクチャ

```
src/
  lib/
    timeCalc.ts          # 計算エンジン（トークナイザ・パーサー・評価器・表示整形）
    timeCalc.test.ts
    calculatorInput.ts   # ボタン入力から数式文字列を組み立てる状態機械
    calculatorInput.test.ts
  components/
    Calculator.tsx       # ボタングリッドと表示
    Calculator.css
  App.tsx
  main.tsx
e2e/
  calculator.spec.ts   # PlaywrightのE2Eテスト（npm run test:e2e、npm testの対象外）
docs/
  spec.md             # 外部仕様書（ユーザーから見た振る舞いの定義）
```

- **`timeCalc.ts`**: `{ kind: 'time'; seconds }` / `{ kind: 'number'; value }` という型付きの値を扱う再帰下降パーサー兼評価器。演算子ごとに組み合わせ可能な型を検査し、不正な組み合わせは `TimeCalcError` を投げる。時間は常に秒で内部保持し、`H:MM`・`H:MM:SS` のどちらの表記もトークナイザで解釈する。結果の整形（`formatTime`）は、秒成分が0かつ端数も無ければ `H:MM`、それ以外は `H:MM:SS` を返す。
- **`calculatorInput.ts`**: ボタン入力（数字・`:`・演算子・括弧・`=`・`AC`・`⌫`）を受け取り、数式文字列を組み立てる純粋な状態機械。括弧の自動補完、コロン（1つの値に最大2つ、それぞれ直前の桁数チェック）、`)` の直後の暗黙の乗算禁止、単項マイナス、`=` 後に演算子を押した場合の続け計算などを担当し、`timeCalc.ts` の計算ロジックとは独立してテストできるようにしている。
- **`Calculator.tsx`**: 上記2つのモジュールを使い、ボタングリッドと数式・結果の表示を行う。結果が時間で秒未満の端数を持つ場合、秒の部分を下線付きで表示する。また、数式表示エリアのタップ位置を文字インデックスに変換し、カーソル移動として扱う。

いずれの `src/lib/*.ts` も `*.test.ts` で仕様上の計算例（符号処理・型エラー・0除算・端数の丸めなど）とボタン入力のエッジケースをカバーしている。
