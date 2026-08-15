// 電卓ボタン入力から数式文字列を組み立てる状態機械。
// 実際の評価は timeCalc.ts の evaluate() に委譲する。
//
// 数式には編集用のカーソル（cursorPos）があり、入力はすべてカーソル位置への
// 挿入・削除として扱う。ボタンを順番に押していく従来の使い方では cursorPos は
// 常に formula の末尾に一致し続けるため、末尾への追記だった頃の挙動と結果は変わらない。

import { evaluate, formatNumber, formatTime, TimeCalcError, type Value } from './timeCalc'

export type Button =
  | { type: 'digit'; d: string }
  | { type: 'colon' }
  | { type: 'decimal' }
  | { type: 'op'; op: '+' | '-' | '*' | '/' }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'backspace' }
  | { type: 'left' }
  | { type: 'right' }
  // 数式表示をタップして直接カーソル位置を指定する（今後実装予定の）機能向け。
  // pos は formula 文字列上のインデックス（0..formula.length）。
  | { type: 'setCursor'; pos: number }
  | { type: 'ac' }
  | { type: 'equals' }

export interface CalcState {
  formula: string
  /** カーソル位置。formula[cursorPos - 1] と formula[cursorPos] の間を指す（0..formula.length）。 */
  cursorPos: number
  result: Value | null
  error: string | null
  justEvaluated: boolean
}

export const initialState: CalcState = {
  formula: '',
  cursorPos: 0,
  result: null,
  error: null,
  justEvaluated: false,
}

function isOperatorChar(c: string | undefined): boolean {
  return c === '+' || c === '-' || c === '*' || c === '/'
}

function isCompleteToken(tok: string): boolean {
  if (tok === '') return true
  return (
    /^-?\d+$/.test(tok) ||
    /^-?\d+:\d{2}$/.test(tok) ||
    /^-?\d+:\d{2}:\d{2}$/.test(tok) ||
    /^-?\d+\.\d+$/.test(tok)
  )
}

/** 入力途中のトークンとして許される形（空文字列・符号のみ・時分秒や小数の途中入力も含む）か */
function isValidInProgressToken(tok: string): boolean {
  return /^-?\d*(:\d{0,2}(:\d{0,2})?|\.\d*)?$/.test(tok)
}

/** カーソルの左側で「入力中」の値トークンを取り出す（単項マイナス符号を含む）。 */
function getTrailingToken(before: string): string {
  const i = before.length
  let j = i
  while (j > 0 && /[\d:.]/.test(before[j - 1])) j--
  let start = j
  if (j > 0 && before[j - 1] === '-') {
    const c = before[j - 2]
    if (c === undefined || isOperatorChar(c) || c === '(') {
      start = j - 1
    }
  }
  return before.slice(start, i)
}

/** カーソルの右側にある「入力中」の値トークンの先頭部分を取り出す。 */
function getLeadingToken(after: string): string {
  return /^[\d:.]*/.exec(after)?.[0] ?? ''
}

function unmatchedOpenParens(s: string): number {
  return (s.match(/\(/g)?.length ?? 0) - (s.match(/\)/g)?.length ?? 0)
}

function split(formula: string, cursorPos: number): { before: string; after: string } {
  return { before: formula.slice(0, cursorPos), after: formula.slice(cursorPos) }
}

/** カーソル位置に文字列を挿入し、カーソルをその直後に移動する。 */
function insertAt(state: CalcState, text: string): CalcState {
  const { before, after } = split(state.formula, state.cursorPos)
  return { ...state, formula: before + text + after, cursorPos: state.cursorPos + text.length }
}

function reentryText(value: Value): string {
  return value.kind === 'number' ? formatNumber(value.value) : formatTime(value.seconds).text
}

function resetIfJustEvaluated(state: CalcState, btn: Button): CalcState {
  if (!state.justEvaluated) return state
  if (btn.type === 'op' && state.result) {
    const formula = reentryText(state.result)
    return { ...initialState, formula, cursorPos: formula.length }
  }
  if (btn.type === 'backspace' || btn.type === 'left' || btn.type === 'right') {
    // エラーや結果を消して、直前の数式をその場で編集できるようにする。
    // カーソルはひとまず末尾に置き、続く操作（backspace で1文字削除 / 左右移動）に委ねる。
    return { ...state, result: null, error: null, justEvaluated: false, cursorPos: state.formula.length }
  }
  if (btn.type === 'setCursor') {
    return { ...state, result: null, error: null, justEvaluated: false }
  }
  return { ...initialState }
}

export function applyButton(stateIn: CalcState, btn: Button): CalcState {
  if (btn.type === 'ac') {
    return { ...initialState }
  }

  const state = resetIfJustEvaluated(stateIn, btn)
  const { formula, cursorPos } = state
  const { before, after } = split(formula, cursorPos)
  const charBefore = before.slice(-1)
  const charAfter = after.slice(0, 1)

  switch (btn.type) {
    case 'digit': {
      if (charBefore === ')') return state // 閉じ括弧の直後は暗黙の乗算になるので禁止
      if (charAfter === '(') return state // 開き括弧の直前も同様
      const trailing = getTrailingToken(before)
      const leading = getLeadingToken(after)
      if (!isValidInProgressToken(trailing + btn.d + leading)) return state
      return insertAt(state, btn.d)
    }

    case 'colon': {
      const trailing = getTrailingToken(before)
      const leading = getLeadingToken(after)
      // カーソルより右に既に：がある位置（既存の区切りの手前）には挿入できない
      if (leading.includes(':')) return state
      if (trailing.includes('.') || leading.includes('.')) return state // 小数とは混在不可
      const parts = trailing.split(':')
      if (parts.length > 2) return state // 3つ目の：は禁止（時・分・秒まで）
      if (parts.length === 1) {
        // 1つ目の：：直前（時の部分）に数字が必要
        if (parts[0].replace('-', '') === '') return state
      } else {
        // 2つ目の：：直前（分の部分）に数字が必要
        if (parts[1] === '') return state
      }
      return insertAt(state, ':')
    }

    case 'decimal': {
      const trailing = getTrailingToken(before)
      const leading = getLeadingToken(after)
      const digitsOnly = trailing.replace('-', '')
      if (digitsOnly === '' || trailing.includes('.') || leading.includes('.')) return state
      if (trailing.includes(':') || leading.includes(':')) return state // 時分表記とは混在不可
      return insertAt(state, '.')
    }

    case 'op': {
      // 演算子の直前への挿入は演算子の連続を生むので禁止（閉じ括弧の直前も同様）
      if (charAfter !== '' && (isOperatorChar(charAfter) || charAfter === ')')) return state
      const trailing = getTrailingToken(before)
      if (!isCompleteToken(trailing)) return state
      const atStart = before === ''
      if (atStart || charBefore === '(' || isOperatorChar(charBefore)) {
        if (btn.op === '-' && charBefore !== '-') {
          return insertAt(state, '-')
        }
        return state
      }
      return insertAt(state, btn.op)
    }

    case 'lparen': {
      const atStart = before === ''
      const okLeft = atStart || charBefore === '(' || isOperatorChar(charBefore)
      const badRight =
        charAfter !== '' && (charAfter === ')' || charAfter === ':' || (isOperatorChar(charAfter) && charAfter !== '-'))
      if (!okLeft || badRight) return state
      return insertAt(state, '(')
    }

    case 'rparen': {
      const trailing = getTrailingToken(before)
      const canCloseLeft = (trailing !== '' && isCompleteToken(trailing)) || charBefore === ')'
      const badRight = charAfter !== '' && /[\d:(]/.test(charAfter)
      if (!canCloseLeft || unmatchedOpenParens(before) <= 0 || badRight) return state
      return insertAt(state, ')')
    }

    case 'backspace': {
      if (cursorPos === 0) return state
      return {
        ...state,
        formula: before.slice(0, -1) + after,
        cursorPos: cursorPos - 1,
        result: null,
        error: null,
      }
    }

    case 'left':
      return { ...state, cursorPos: Math.max(0, cursorPos - 1) }

    case 'right':
      return { ...state, cursorPos: Math.min(formula.length, cursorPos + 1) }

    case 'setCursor':
      return { ...state, cursorPos: Math.max(0, Math.min(btn.pos, formula.length)) }

    case 'equals': {
      if (formula === '') return state
      const trailingAtEnd = getTrailingToken(formula)
      const lastChar = formula.slice(-1)
      const canEval = (trailingAtEnd !== '' && isCompleteToken(trailingAtEnd)) || lastChar === ')'
      if (!canEval) return state

      const missingParens = Math.max(0, unmatchedOpenParens(formula))
      const finalFormula = formula + ')'.repeat(missingParens)

      try {
        const value = evaluate(finalFormula)
        return {
          ...state,
          formula: finalFormula,
          cursorPos: finalFormula.length,
          result: value,
          error: null,
          justEvaluated: true,
        }
      } catch (e) {
        const message = e instanceof TimeCalcError ? e.message : '計算できません'
        return {
          ...state,
          formula: finalFormula,
          cursorPos: finalFormula.length,
          result: null,
          error: message,
          justEvaluated: true,
        }
      }
    }
  }
}
