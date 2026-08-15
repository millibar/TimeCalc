/**
 * TimeCalc の E2Eテスト。
 *
 * docs/spec.md（外部仕様書）に記載された、ユーザーから見た振る舞いを実ブラウザ（Chromium）で検証する。
 * 実装の詳細（コード構成・内部データ表現）には立ち入らず、画面上のボタン操作と表示内容だけを見る。
 *
 * `npm run test:e2e`（`playwright test`）で実行できる。`playwright.config.ts` が
 * テスト実行前に `npm run dev` を自動起動する（既に起動済みならそれを再利用する）。
 *
 * Playwright MCP で手動確認する際の台帳としても引き続き使える。新しい機能を確認したら
 * このファイルにもテストとして追記すること（詳細は CLAUDE.md「PlaywrightによるE2Eテスト」参照）。
 */
import { test, expect, type Page } from '@playwright/test'

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

/** AC で状態をクリアしてから、ラベル列を入力する。各テストを独立させるためのヘルパー。 */
async function calculate(page: Page, labels: ButtonLabel[]) {
  await press(page, 'AC')
  await pressAll(page, labels)
  return readDisplay(page)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test.describe('基本の計算', () => {
  test('時間 + 時間 → 時間（1:30 + 3:45 = 5:15）', async ({ page }) => {
    const { formulaText, resultText } = await calculate(page, [
      '1', '：', '3', '0', '+', '3', '：', '4', '5', '=',
    ])
    expect(formulaText).toBe('1:30 + 3:45')
    expect(resultText).toBe('5:15')
  })

  test('時間 - 時間 が負になる場合は符号付きで表示（2:59 - 3:00 = -0:01）', async ({ page }) => {
    const { resultText } = await calculate(page, ['2', '：', '5', '9', '−', '3', '：', '00', '='])
    expect(resultText).toBe('-0:01')
  })

  test('括弧で優先順位を指定できる（(1:30 + 0:30) × 2 = 4:00）', async ({ page }) => {
    const { formulaText, resultText } = await calculate(page, [
      '(', '1', '：', '3', '0', '+', '0', '：', '3', '0', ')', '×', '2', '=',
    ])
    expect(formulaText).toBe('(1:30 + 0:30) × 2')
    expect(resultText).toBe('4:00')
  })

  test('単項マイナスで負の値を入力できる（1:00 + -3:00 = -2:00）', async ({ page }) => {
    const { formulaText, resultText } = await calculate(page, [
      '1', '：', '0', '0', '+', '−', '3', '：', '0', '0', '=',
    ])
    expect(formulaText).toBe('1:00 + -3:00')
    expect(resultText).toBe('-2:00')
  })
})

test.describe('計算のルール（時間と数値の組み合わせ）', () => {
  const cases: { name: string; keys: ButtonLabel[]; expectError: boolean; expected: string }[] = [
    { name: '時間 + 時間 → 時間', keys: ['1', '：', '0', '0', '+', '1', '：', '0', '0'], expectError: false, expected: '2:00' },
    { name: '数値 + 数値 → 数値', keys: ['1', '+', '2'], expectError: false, expected: '3' },
    { name: '時間 + 数値 はエラー', keys: ['1', '：', '3', '0', '+', '5'], expectError: true, expected: '時間と数値は加算できません' },
    { name: '数値 + 時間 はエラー', keys: ['5', '+', '1', '：', '3', '0'], expectError: true, expected: '時間と数値は加算できません' },
    { name: '時間 - 数値 はエラー', keys: ['1', '：', '3', '0', '−', '5'], expectError: true, expected: '時間と数値は減算できません' },
    { name: '数値 - 時間 はエラー', keys: ['5', '−', '1', '：', '3', '0'], expectError: true, expected: '時間と数値は減算できません' },
    { name: '時間 × 数値 → 時間', keys: ['1', '：', '3', '0', '×', '2'], expectError: false, expected: '3:00' },
    { name: '数値 × 時間 → 時間', keys: ['2', '×', '1', '：', '3', '0'], expectError: false, expected: '3:00' },
    { name: '数値 × 数値 → 数値', keys: ['3', '×', '4'], expectError: false, expected: '12' },
    { name: '時間 × 時間 はエラー', keys: ['1', '：', '0', '0', '×', '1', '：', '0', '0'], expectError: true, expected: '時間同士は乗算できません' },
    { name: '時間 ÷ 数値 → 時間', keys: ['1', '：', '0', '0', '÷', '2'], expectError: false, expected: '0:30' },
    { name: '時間 ÷ 時間 → 数値（比率）', keys: ['3', '：', '0', '0', '÷', '1', '：', '3', '0'], expectError: false, expected: '2' },
    { name: '数値 ÷ 数値 → 数値', keys: ['1', '0', '÷', '4'], expectError: false, expected: '2.5' },
    { name: '数値 ÷ 時間 はエラー', keys: ['5', '÷', '1', '：', '3', '0'], expectError: true, expected: '数値を時間で割ることはできません' },
    { name: '時間 ÷ 0 はエラー', keys: ['1', '：', '0', '0', '÷', '0'], expectError: true, expected: '0で割ることはできません' },
    { name: '時間 ÷ 0:00 はエラー', keys: ['1', '：', '0', '0', '÷', '0', '：', '0', '0'], expectError: true, expected: '0で割ることはできません' },
    { name: '数値 ÷ 0 はエラー', keys: ['5', '÷', '0'], expectError: true, expected: '0で割ることはできません' },
  ]

  for (const { name, keys, expectError, expected } of cases) {
    test(name, async ({ page }) => {
      const { resultText, isError } = await calculate(page, [...keys, '='])
      expect(isError).toBe(expectError)
      expect(resultText).toBe(expected)
    })
  }
})

test.describe('表示形式', () => {
  test('分未満の端数が残る結果は分の部分に下線が付く（40:00 ÷ 7 × 31 = 177:08）', async ({ page }) => {
    const { formulaText, resultText, hasSubMinute } = await calculate(page, [
      '4', '0', '：', '00', '÷', '7', '×', '3', '1', '=',
    ])
    expect(formulaText).toBe('40:00 ÷ 7 × 31')
    expect(resultText).toBe('177:08')
    expect(hasSubMinute).toBe(true)
  })

  test('分未満の端数が無い結果には下線が付かない', async ({ page }) => {
    const { resultText, hasSubMinute } = await calculate(page, ['1', '：', '0', '0', '÷', '2', '='])
    expect(resultText).toBe('0:30')
    expect(hasSubMinute).toBe(false)
  })

  test('小数の数値は小数点以下も表示される（1 ÷ 3 = 0.333333）', async ({ page }) => {
    const { resultText } = await calculate(page, ['1', '÷', '3', '='])
    expect(resultText).toBe('0.333333')
  })

  test('演算子は前後に半角スペースを入れて表示される', async ({ page }) => {
    const { formulaText } = await calculate(page, ['5', '−', '2'])
    expect(formulaText).toBe('5 - 2')
  })
})

test.describe('入力の妥当性チェック（誤入力の防止）', () => {
  test('演算子を連続して入力することはできない', async ({ page }) => {
    await calculate(page, ['1', '+'])
    await press(page, '×') // + の直後に × は入力できない
    const { formulaText } = await readDisplay(page)
    expect(formulaText).toBe('1 +')
  })

  test('式の先頭に × や ÷ を入力することはできない（− は符号として入力できる）', async ({ page }) => {
    await calculate(page, ['×'])
    let { formulaText } = await readDisplay(page)
    expect(formulaText).toBe('')

    await press(page, '÷')
    ;({ formulaText } = await readDisplay(page))
    expect(formulaText).toBe('')

    const { resultText } = await calculate(page, ['−', '5', '='])
    expect(resultText).toBe('-5')
  })

  test('閉じ括弧の直後に、演算子を挟まずに数字を入力することはできない（暗黙の乗算の禁止）', async ({ page }) => {
    await calculate(page, ['(', '1', '+', '2', ')'])
    await press(page, '3') // 暗黙の乗算になるため入力できない
    const { formulaText } = await readDisplay(page)
    expect(formulaText).toBe('(1 + 2)')

    // 演算子を挟めば続けて入力できる
    const { formulaText: formulaText2, resultText } = await calculate(page, [
      '(', '1', '+', '2', ')', '×', '3', '=',
    ])
    expect(formulaText2).toBe('(1 + 2) × 3')
    expect(resultText).toBe('9')
  })

  test('時分の区切り「：」は、数字が無い状態では入力できない', async ({ page }) => {
    await calculate(page, ['：'])
    let { formulaText } = await readDisplay(page)
    expect(formulaText).toBe('')

    await press(page, '5')
    ;({ formulaText } = await readDisplay(page))
    expect(formulaText).toBe('5')
  })

  test('1つの値の中に「：」を2つ以上入力することはできない', async ({ page }) => {
    await calculate(page, ['1', '：', '3', '0', '：'])
    const { formulaText } = await readDisplay(page)
    expect(formulaText).toBe('1:30')
  })

  test('時分の区切りと小数点は同じ値に混在できない', async ({ page }) => {
    await calculate(page, ['1', '：', '3', '0', '.'])
    let { formulaText } = await readDisplay(page)
    expect(formulaText).toBe('1:30')

    await calculate(page, ['3', '.', '5', '：'])
    ;({ formulaText } = await readDisplay(page))
    expect(formulaText).toBe('3.5')
  })
})

test.describe('計算の実行（=）と続けて計算', () => {
  test('閉じられていない括弧が残っている場合は自動的に補って計算する', async ({ page }) => {
    const { formulaText, resultText } = await calculate(page, [
      '(', '1', '：', '0', '0', '+', '2', '：', '0', '0', '=',
    ])
    expect(formulaText).toBe('(1:00 + 2:00)')
    expect(resultText).toBe('3:00')
  })

  test('式が演算子で終わっているなど、計算を完了できない状態では = を押しても何も起こらない', async ({ page }) => {
    const { formulaText, resultText } = await calculate(page, ['1', '：', '3', '0', '+', '='])
    expect(formulaText).toBe('1:30 +')
    expect(resultText.trim()).toBe('')
  })

  test('= の後に演算子を押すと直前の結果から続けて計算できる', async ({ page }) => {
    await calculate(page, ['1', '：', '0', '0', '+', '1', '：', '0', '0', '='])
    expect((await readDisplay(page)).resultText).toBe('2:00')

    await pressAll(page, ['+', '3', '：', '0', '0', '='])
    const { formulaText, resultText } = await readDisplay(page)
    expect(formulaText).toBe('2:00 + 3:00')
    expect(resultText).toBe('5:00')
  })

  test('= の後に数字を押すと、新しい数式として最初から入力し直せる', async ({ page }) => {
    await calculate(page, ['1', '：', '0', '0', '+', '1', '：', '0', '0', '='])
    expect((await readDisplay(page)).resultText).toBe('2:00')

    await press(page, '9')
    const { formulaText, resultText } = await readDisplay(page)
    expect(formulaText).toBe('9')
    expect(resultText.trim()).toBe('')
  })
})

test.describe('エラー表示', () => {
  test('計算できない式では、結果表示にエラーメッセージが表示される', async ({ page }) => {
    const { isError, resultText } = await calculate(page, ['1', '：', '3', '0', '+', '5', '='])
    expect(isError).toBe(true)
    expect(resultText).toBe('時間と数値は加算できません')
  })

  test('エラー表示中も数式は保持され、⌫ で編集モードに戻って修正できる', async ({ page }) => {
    await calculate(page, ['1', '：', '3', '0', '+', '5', '='])
    expect((await readDisplay(page)).isError).toBe(true)

    await press(page, '⌫')
    const { formulaText, resultText, isError } = await readDisplay(page)
    expect(formulaText).toBe('1:30 +')
    expect(resultText.trim()).toBe('')
    expect(isError).toBe(false)
  })
})

test.describe('入力の編集操作', () => {
  test('AC で数式と結果がクリアされる', async ({ page }) => {
    const { formulaText, resultText } = await calculate(page, [
      '1', '：', '3', '0', '+', '3', '：', '4', '5', '=', 'AC',
    ])
    expect(formulaText).toBe('')
    expect(resultText.trim()).toBe('')
  })

  test('= の直後に ⌫ を押すと編集モードに戻り、結果表示は消える', async ({ page }) => {
    await calculate(page, ['1', '：', '0', '0', '+', '1', '：', '0', '0', '='])
    expect((await readDisplay(page)).resultText).toBe('2:00')

    await press(page, '⌫')
    const { formulaText, resultText } = await readDisplay(page)
    expect(formulaText).toBe('1:00 + 1:0')
    expect(resultText.trim()).toBe('')
  })

  test('← → でカーソルが移動し、その位置に文字を挿入できる', async ({ page }) => {
    await calculate(page, ['1', '2', '+', '3', '4'])
    expect((await readDisplay(page)).formulaText).toBe('12 + 34')

    // カーソルは末尾（"34" の直後）にあるので、2つ左に動かして "3" と "4" の間に置き、
    // 1つ右に戻して "+" と "3" の間で止める。
    await press(page, '←')
    await press(page, '←')
    await press(page, '→')
    await press(page, '9')
    expect((await readDisplay(page)).formulaText).toBe('12 + 394')
  })

  test('数式表示エリアをタップするとその位置にカーソルが移動する', async ({ page }) => {
    await calculate(page, ['1', '2', '+', '3', '4'])
    expect((await readDisplay(page)).formulaText).toBe('12 + 34')

    // 数式表示は右寄せなので、表示エリアの左端付近（先頭文字の直前）をクリックする。
    const box = await page.locator('.display-formula').boundingBox()
    if (!box) throw new Error('display-formula の bounding box が取得できません')
    await page.mouse.click(box.x + 2, box.y + box.height / 2)

    // カーソルは先頭（"1" の直前）に移動しているはずなので、9を入力すると先頭に挿入される。
    await press(page, '9')
    expect((await readDisplay(page)).formulaText).toBe('912 + 34')
  })
})
