import { defineConfig, devices } from '@playwright/test'

const isCI = !!process.env.CI

// `npm run test:e2e` で `npx playwright test` を実行するための設定。
// docs/spec.md に記載のユーザーから見た振る舞いを、実ブラウザ（Chromium）で検証する。
// GitHub Actions（.github/workflows/ci.yml）からも同じ設定で実行される。
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // CIではたまたま落ちたテストで赤くしないよう1回だけリトライする。ローカルではリトライしない。
  retries: isCI ? 1 : 0,
  // CI上ではジョブのログにインラインでエラー注釈が出る 'github' レポーターと、
  // 失敗時に手元で確認できる 'html' レポーターを使う。ローカルでは 'list' で十分。
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173/TimeCalc/',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // テスト実行前に Vite の開発サーバーを自動起動する（既に起動済みならそれを再利用する）。
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/TimeCalc/',
    reuseExistingServer: !isCI,
  },
})
