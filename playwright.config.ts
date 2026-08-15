import { defineConfig, devices } from '@playwright/test'

// `npm run test:e2e` で `npx playwright test` を実行するための設定。
// docs/spec.md に記載のユーザーから見た振る舞いを、実ブラウザ（Chromium）で検証する。
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
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
    reuseExistingServer: true,
  },
})
