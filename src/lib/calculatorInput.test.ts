import { describe, expect, it } from 'vitest'
import { applyButton, initialState, type Button, type CalcState } from './calculatorInput'

function press(state: CalcState, ...btns: Button[]): CalcState {
  return btns.reduce(applyButton, state)
}

const d = (s: string): Button[] => s.split('').map((c) => ({ type: 'digit', d: c }))
const colon: Button = { type: 'colon' }
const op = (o: '+' | '-' | '*' | '/'): Button => ({ type: 'op', op: o })
const lparen: Button = { type: 'lparen' }
const rparen: Button = { type: 'rparen' }
const backspace: Button = { type: 'backspace' }
const left: Button = { type: 'left' }
const right: Button = { type: 'right' }
const setCursor = (pos: number): Button => ({ type: 'setCursor', pos })
const equals: Button = { type: 'equals' }
const ac: Button = { type: 'ac' }

describe('applyButton', () => {
  it('builds a simple time+time formula and evaluates it', () => {
    const s = press(initialState, ...d('1'), colon, ...d('30'), op('+'), ...d('3'), colon, ...d('45'), equals)
    expect(s.formula).toBe('1:30+3:45')
    expect(s.result).toEqual({ kind: 'time', seconds: 5 * 3600 + 15 * 60 })
    expect(s.error).toBeNull()
  })

  it('blocks a second colon within the same token', () => {
    const s = press(initialState, ...d('1'), colon, ...d('3'), colon)
    expect(s.formula).toBe('1:3')
  })

  it('blocks a third minute digit', () => {
    const s = press(initialState, ...d('1'), colon, ...d('305'))
    expect(s.formula).toBe('1:30')
  })

  it('blocks colon with no digits yet', () => {
    const s = press(initialState, colon)
    expect(s.formula).toBe('')
  })

  it('allows a leading unary minus but not a double minus', () => {
    const s1 = press(initialState, op('-'))
    expect(s1.formula).toBe('-')
    const s2 = press(s1, op('-'))
    expect(s2.formula).toBe('-')
  })

  it('ignores unary +, *, / at the start', () => {
    expect(press(initialState, op('+')).formula).toBe('')
    expect(press(initialState, op('*')).formula).toBe('')
    expect(press(initialState, op('/')).formula).toBe('')
  })

  it('blocks an operator right after an incomplete time', () => {
    const s = press(initialState, ...d('1'), colon, ...d('3'), op('+'))
    expect(s.formula).toBe('1:3')
  })

  it('blocks digits immediately after a close paren (no implicit multiplication)', () => {
    const s = press(initialState, lparen, ...d('1'), rparen, ...d('2'))
    expect(s.formula).toBe('(1)')
  })

  it('blocks a close paren with nothing open', () => {
    const s = press(initialState, ...d('1'), rparen)
    expect(s.formula).toBe('1')
  })

  it('auto-closes unmatched open parens on equals', () => {
    const s = press(initialState, lparen, ...d('1'), op('+'), ...d('2'), equals)
    expect(s.formula).toBe('(1+2)')
    expect(s.result).toEqual({ kind: 'number', value: 3 })
  })

  it('backspace edits the in-progress token and clears a stale result', () => {
    const s1 = press(initialState, ...d('12'), colon, ...d('30'), equals)
    expect(s1.justEvaluated).toBe(true)
    const s2 = press(s1, ...d('1')) // any digit after equals starts fresh
    expect(s2.formula).toBe('1')
    const s3 = press(initialState, ...d('12'), backspace, backspace)
    expect(s3.formula).toBe('')
  })

  it('chains an operator onto the previous result after equals', () => {
    const s1 = press(initialState, ...d('1'), colon, ...d('00'), op('+'), ...d('2'), colon, ...d('00'), equals)
    expect(s1.result).toEqual({ kind: 'time', seconds: 3 * 3600 })
    const s2 = press(s1, op('-'), ...d('1'), colon, ...d('00'), equals)
    expect(s2.formula).toBe('3:00-1:00')
    expect(s2.result).toEqual({ kind: 'time', seconds: 2 * 3600 })
  })

  it('starting fresh with a digit after equals does not chain', () => {
    const s1 = press(initialState, ...d('1'), colon, ...d('00'), op('+'), ...d('2'), colon, ...d('00'), equals)
    const s2 = press(s1, ...d('5'))
    expect(s2.formula).toBe('5')
  })

  it('reports an error for invalid type combinations and stays recoverable', () => {
    const s1 = press(initialState, ...d('1'), colon, ...d('00'), op('+'), ...d('1'), equals)
    expect(s1.error).not.toBeNull()
    expect(s1.justEvaluated).toBe(true)
    const s2 = press(s1, backspace)
    expect(s2.error).toBeNull()
    expect(s2.formula).toBe('1:00+')
  })

  it('AC resets everything', () => {
    const s1 = press(initialState, ...d('1'), colon, ...d('00'), op('+'), ...d('1'), colon, ...d('00'), equals)
    const s2 = press(s1, ac)
    expect(s2).toEqual(initialState)
  })

  it('cursor tracks the end of the formula while typing normally', () => {
    const s = press(initialState, ...d('1'), colon, ...d('30'))
    expect(s.cursorPos).toBe(s.formula.length)
  })
})

describe('cursor movement', () => {
  it('moves left and right, clamped to the formula bounds', () => {
    const s0 = press(initialState, ...d('123'))
    expect(s0.cursorPos).toBe(3)
    const s1 = press(s0, left, left)
    expect(s1.cursorPos).toBe(1)
    const s2 = press(s1, left, left, left) // 左端でクランプされる
    expect(s2.cursorPos).toBe(0)
    const s3 = press(s2, right, right, right, right, right) // 右端でクランプされる
    expect(s3.cursorPos).toBe(3)
  })

  it('setCursor clamps to the formula bounds', () => {
    const s0 = press(initialState, ...d('123'))
    expect(press(s0, setCursor(1)).cursorPos).toBe(1)
    expect(press(s0, setCursor(-5)).cursorPos).toBe(0)
    expect(press(s0, setCursor(99)).cursorPos).toBe(3)
  })
})

describe('editing in the middle of the formula', () => {
  it('inserts a digit at the cursor, extending the token it sits inside', () => {
    const s = press(initialState, ...d('13'), left, ...d('2'))
    expect(s.formula).toBe('123')
    expect(s.cursorPos).toBe(2)
  })

  it('inserts an hour digit before an existing colon', () => {
    const s = press(initialState, ...d('1'), colon, ...d('30'), setCursor(1), ...d('2'))
    expect(s.formula).toBe('12:30')
  })

  it('blocks a second colon when the cursor sits before an existing one', () => {
    const s = press(initialState, ...d('1'), colon, ...d('30'), setCursor(1), colon)
    expect(s.formula).toBe('1:30')
  })

  it('blocks a third minute digit inserted mid-token', () => {
    const s = press(initialState, ...d('1'), colon, ...d('30'), setCursor(3), ...d('9'))
    expect(s.formula).toBe('1:30')
  })

  it('splits a number in two when an operator is inserted mid-token', () => {
    const s = press(initialState, ...d('123'), left, op('+'))
    expect(s.formula).toBe('12+3')
  })

  it('blocks an operator that would end up next to another operator', () => {
    const s = press(initialState, ...d('1'), op('+'), ...d('2'), left, op('*'))
    expect(s.formula).toBe('1+2')
  })

  it('backspaces the character to the left of the cursor', () => {
    const s = press(initialState, ...d('123'), left, backspace)
    expect(s.formula).toBe('13')
    expect(s.cursorPos).toBe(1)
  })

  it('does nothing when backspacing at the very start', () => {
    const s = press(initialState, ...d('123'), setCursor(0), backspace)
    expect(s.formula).toBe('123')
    expect(s.cursorPos).toBe(0)
  })

  it('inserts a paren pair around content via cursor movement', () => {
    const s = press(initialState, ...d('1'), op('+'), ...d('2'), setCursor(0), lparen, right, right, right, rparen)
    expect(s.formula).toBe('(1+2)')
  })

  it('blocks a digit right before an open paren (implicit multiplication)', () => {
    const s = press(initialState, lparen, ...d('1'), rparen, setCursor(0), ...d('9'))
    expect(s.formula).toBe('(1)')
  })

  it('lets the user resume editing with arrow keys right after equals', () => {
    const s1 = press(initialState, ...d('1'), colon, ...d('00'), op('+'), ...d('2'), colon, ...d('00'), equals)
    expect(s1.justEvaluated).toBe(true)
    const s2 = press(s1, left, left, left, backspace) // '1:00+2:00' の '2' を消す
    expect(s2.formula).toBe('1:00+:00')
    expect(s2.justEvaluated).toBe(false)
    expect(s2.error).toBeNull()
  })
})
