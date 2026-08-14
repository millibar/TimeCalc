/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Vitest のデフォルト exclude（vitest/config の defaultExclude と同じ内容）。
// vitest/config から import すると、上の triple-slash-reference と重複するとして
// ESLint（@typescript-eslint/triple-slash-reference）にエラーにされるため、直値で複製している。
const vitestDefaultExclude = [
  '**/node_modules/**',
  '**/dist/**',
  '**/cypress/**',
  '**/.{idea,git,cache,output,temp}/**',
  '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
]

export default defineConfig({
  base: '/TimeCalc/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'TimeCalc',
        short_name: 'TimeCalc',
        description: '時間数式を計算する電卓',
        theme_color: '#1e1e2e',
        background_color: '#1e1e2e',
        display: 'standalone',
        start_url: '/TimeCalc/',
        scope: '/TimeCalc/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    // e2e/ は @playwright/test を前提にしたリファレンス用テストコード（Playwright MCP用の
    // シナリオ台帳）で、@playwright/test を依存関係に追加していないため Vitest の対象からは除外する。
    exclude: [...vitestDefaultExclude, 'e2e/**'],
  },
})
