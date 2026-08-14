/**
 * TimeCalc の E2Eテスト（Playwright Test 形式のリファレンス）。
 *
 * 【重要】このファイルは `npm test`（Vitest）や `npm run lint` の対象外で、
 * package.json にも `@playwright/test` を依存関係として追加していない
 * （CLAUDE.md「PlaywrightによるE2Eテスト」節の方針どおり）。
 * そのため `npx playwright test` はこのままでは実行できない。
 *
 * このファイルの役割は、Playwright MCP で動作確認を行う際の「シナリオ台帳」。
 * 今後 Claude Code が `npm run dev` + Playwright MCP で画面を確認するときは、
 * ここに書かれた操作手順・期待結果を参考にする（MCPのツール呼び出しに読み替えて実行する）。
 *
 * 実際に `npx playwright test` で自動実行したくなった場合は、
 * `npm install -D @playwright/test` の上で `npx playwright test e2e/` を実行する
 * （詳細は CLAUDE.md 参照）。
 *
 * 各テストで検証している内容は 2026-08-14 に Playwright MCP（実Chromium）で
 * 一つずつ手動確認済み。
 */
import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173/TimeCalc/'

/** ボタンのラベル一覧。全角記号（：− × ÷）を使う点に注意（半角では見つからない）。 */
type ButtonLabel =
  | 'AC' | '←' | '→' | '⌫'
  | '00' | '(' | ')' | '÷'
  | '7' | '8' | '9' | '×'
  | '4' | '5' | '6' | '−'
  | '1' | '2' | '3' | '+'
  | '0' | '：' | '.' | '='

/** ボタンを1つ押す。'0' と '00' のような部分一致を避けるため exact: true を使う。 */
async function press(page: Page, label: ButtonLabel) {
  await page.getByRole('button', { name: label, exact: true }).click()
}

/** ラベルを順番に押して数式を入力する。 */
async function pressAll(page: Page, labels: ButtonLabel[]) {
  for (const label of labels) {
    await press(page, label)
  }
}

/** 数式表示・結果表示の現在の状態を読み取る。 */
async function readDisplay(page: Page) {
  const formula = page.locator('.display-formula')
  const result = page.locator('.display-result')
  return {
    formulaText: (await formula.textContent()) ?? '',
    resultText: (await result.textContent()) ?? '',
    isError: (await result.getAttribute('class'))?.includes('is-error') ?? false,
    hasSubMinute: (await result.locator('.sub-minute').count()) > 0,
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_URL)
})

test.describe('基本の計算', () => {
  test('時間 + 時間 → 時間（1:30 + 3:45 = 5:15）', async ({ page }) => {
    await pressAll(page, ['1', '：', '3', '0', '+', '3', '：', '4', '5', '='])
    const { formulaText, resultText } = await readDisplay(page)
    expect(formulaText).toBe('1:30 + 3:45')
    expect(resultText).toBe('5:15')
  })

  test('時間 - 時間 が負になる場合は符号付きで表示（2:59 - 3:00 = -0:01）', async ({ page }) => {
    await pressAll(page, ['2', '：', '5', '9', '−', '3', '：', '00', '='])
    const { resultText } = await readDisplay(page)
    expect(resultText).toBe('-0:01')
  })

  test('括弧で優先順位を指定できる（(1:30 + 0:30) × 2 = 4:00）', async ({ page }) => {
    await pressAll(page, [
      '(', '1', '：', '3', '0', '+', '0', '：', '3', '0', ')', '×', '2', '=',
    ])
    const { formulaText, resultText } = await readDisplay(page)
    expect(formulaText).toBe('(1:30 + 0:30) × 2')
    expect(resultText).toBe('4:00')
  })

  test('= の後に演算子を押すと直前の結果から続けて計算できる', async ({ page }) => {
    await pressAll(page, ['1', '：', '0', '0', '+', '1', '：', '0', '0', '='])
    expect((await readDisplay(page)).resultText).toBe('2:00')

    await pressAll(page, ['+', '3', '：', '0', '0', '='])
    const { formulaText, resultText } = await readDisplay(page)
    expect(formulaText).toBe('2:00 + 3:00')
    expect(resultText).toBe('5:00')
  })
})

test.describe('分未満の端数', () => {
  test('分未満の端数が残る結果は分の部分に下線が付く（40:00 ÷ 7 × 31 = 177:08）', async ({ page }) => {
    await pressAll(page, ['4', '0', '：', '00', '÷', '7', '×', '3', '1', '='])
    const { formulaText, resultText, hasSubMinute } = await readDisplay(page)
    expect(formulaText).toBe('40:00 ÷ 7 × 31')
    expect(resultText).toBe('177:08')
    expect(hasSubMinute).toBe(true)
  })
})

test.describe('エラー', () => {
  test('時間と数値は加算できない', async ({ page }) => {
    await pressAll(page, ['1', '：', '3', '0', '+', '5', '='])
    const { isError, resultText } = await readDisplay(page)
    expect(isError).toBe(true)
    expect(resultText).toBe('時間と数値は加算できません')
  })
})

test.describe('入力の編集操作', () => {
  test('AC で数式と結果がクリアされる', async ({ page }) => {
    await pressAll(page, ['1', '：', '3', '0', '+', '3', '：', '4', '5', '='])
    await press(page, 'AC')
    const { formulaText, resultText } = await readDisplay(page)
    expect(formulaText).toBe('')
    expect(resultText.trim()).toBe('')
  })

  test('= の直後に ⌫ を押すと編集モードに戻り、結果表示は消える', async ({ page }) => {
    await pressAll(page, ['1', '：', '0', '0', '+', '1', '：', '0', '0', '='])
    expect((await readDisplay(page)).resultText).toBe('2:00')

    await press(page, '⌫')
    const { formulaText, resultText } = await readDisplay(page)
    expect(formulaText).toBe('1:00 + 1:0')
    expect(resultText.trim()).toBe('')
  })

  test('数式表示エリアをタップするとその位置にカーソルが移動する', async ({ page }) => {
    await pressAll(page, ['1', '2', '+', '3', '4'])
    expect((await readDisplay(page)).formulaText).toBe('12 + 34')

    // 数式表示は右寄せなので、表示エリアの左端付近（先頭文字の直前）をクリックする。
    // jsdom は caretRangeFromPoint/caretPositionFromPoint を実装していないため、
    // このタップ→カーソル移動の一連の挙動は実ブラウザ（Playwright）でのみ検証できる
    // （src/lib/timeCalc.ts の formulaIndexFromPrettyIndex 自体は Vitest でカバー済み）。
    const box = await page.locator('.display-formula').boundingBox()
    if (!box) throw new Error('display-formula の bounding box が取得できません')
    await page.mouse.click(box.x + 2, box.y + box.height / 2)

    // カーソルは先頭（"1" の直前）に移動しているはずなので、9を入力すると先頭に挿入される。
    await press(page, '9')
    expect((await readDisplay(page)).formulaText).toBe('912 + 34')
  })
})
