// 電卓ボタン入力から数式文字列を組み立てる状態機械。
// 実際の評価は timeCalc.ts の evaluate() に委譲する。

import { evaluate, formatNumber, formatTime, TimeCalcError, type Value } from './timeCalc'

export type Button =
  | { type: 'digit'; d: string }
  | { type: 'colon' }
  | { type: 'op'; op: '+' | '-' | '*' | '/' }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'backspace' }
  | { type: 'ac' }
  | { type: 'equals' }

export interface CalcState {
  formula: string
  openCount: number
  closeCount: number
  result: Value | null
  error: string | null
  justEvaluated: boolean
}

export const initialState: CalcState = {
  formula: '',
  openCount: 0,
  closeCount: 0,
  result: null,
  error: null,
  justEvaluated: false,
}

function isOperatorChar(c: string | undefined): boolean {
  return c === '+' || c === '-' || c === '*' || c === '/'
}

function isCompleteToken(tok: string): boolean {
  if (tok === '') return true
  return /^-?\d+$/.test(tok) || /^-?\d+:\d{2}$/.test(tok)
}

/** 数式末尾で「入力中」の値トークンを取り出す（単項マイナス符号を含む）。 */
function getTrailingToken(formula: string): string {
  const i = formula.length
  let j = i
  while (j > 0 && /[\d:]/.test(formula[j - 1])) j--
  let start = j
  if (j > 0 && formula[j - 1] === '-') {
    const before = formula[j - 2]
    if (before === undefined || isOperatorChar(before) || before === '(') {
      start = j - 1
    }
  }
  return formula.slice(start, i)
}

function reentryText(value: Value): string {
  return value.kind === 'number' ? formatNumber(value.value) : formatTime(value.seconds).text
}

function resetIfJustEvaluated(state: CalcState, btn: Button): CalcState {
  if (!state.justEvaluated) return state
  if (btn.type === 'op' && state.result) {
    return { ...initialState, formula: reentryText(state.result) }
  }
  if (btn.type === 'backspace') {
    // エラーや結果を消して、直前の数式をその場で編集できるようにする
    return { ...state, result: null, error: null, justEvaluated: false }
  }
  return { ...initialState }
}

export function applyButton(stateIn: CalcState, btn: Button): CalcState {
  if (btn.type === 'ac') {
    return { ...initialState }
  }

  const state = resetIfJustEvaluated(stateIn, btn)
  const { formula } = state

  switch (btn.type) {
    case 'digit': {
      if (formula.endsWith(')')) return state
      const trailing = getTrailingToken(formula)
      if (trailing.includes(':')) {
        const minutePart = trailing.split(':')[1]
        if (minutePart.length >= 2) return state
      }
      return { ...state, formula: formula + btn.d }
    }

    case 'colon': {
      const trailing = getTrailingToken(formula)
      const digitsOnly = trailing.replace('-', '')
      if (digitsOnly === '' || trailing.includes(':')) return state
      return { ...state, formula: formula + ':' }
    }

    case 'op': {
      const trailing = getTrailingToken(formula)
      if (!isCompleteToken(trailing)) return state
      const lastChar = formula.slice(-1)
      const atStart = formula === ''
      if (atStart || lastChar === '(' || isOperatorChar(lastChar)) {
        if (btn.op === '-' && lastChar !== '-') {
          return { ...state, formula: formula + '-' }
        }
        return state
      }
      return { ...state, formula: formula + btn.op }
    }

    case 'lparen': {
      const lastChar = formula.slice(-1)
      const atStart = formula === ''
      if (atStart || lastChar === '(' || isOperatorChar(lastChar)) {
        return { ...state, formula: formula + '(', openCount: state.openCount + 1 }
      }
      return state
    }

    case 'rparen': {
      const trailing = getTrailingToken(formula)
      const lastChar = formula.slice(-1)
      const canClose = (trailing !== '' && isCompleteToken(trailing)) || lastChar === ')'
      if (!canClose || state.openCount <= state.closeCount) return state
      return { ...state, formula: formula + ')', closeCount: state.closeCount + 1 }
    }

    case 'backspace': {
      if (formula === '') return state
      const removed = formula.slice(-1)
      return {
        ...state,
        formula: formula.slice(0, -1),
        openCount: removed === '(' ? state.openCount - 1 : state.openCount,
        closeCount: removed === ')' ? state.closeCount - 1 : state.closeCount,
        result: null,
        error: null,
      }
    }

    case 'equals': {
      if (formula === '') return state
      const trailing = getTrailingToken(formula)
      const lastChar = formula.slice(-1)
      const canEval = (trailing !== '' && isCompleteToken(trailing)) || lastChar === ')'
      if (!canEval) return state

      const missingParens = Math.max(0, state.openCount - state.closeCount)
      const finalFormula = formula + ')'.repeat(missingParens)
      const finalCloseCount = state.closeCount + missingParens

      try {
        const value = evaluate(finalFormula)
        return {
          ...state,
          formula: finalFormula,
          closeCount: finalCloseCount,
          result: value,
          error: null,
          justEvaluated: true,
        }
      } catch (e) {
        const message = e instanceof TimeCalcError ? e.message : '計算できません'
        return {
          ...state,
          formula: finalFormula,
          closeCount: finalCloseCount,
          result: null,
          error: message,
          justEvaluated: true,
        }
      }
    }
  }
}
