import { describe, expect, it } from 'vitest'
import {
  evaluate,
  formatNumber,
  formatTime,
  formulaIndexFromPrettyIndex,
  prettyCursorIndex,
  prettyFormula,
  TimeCalcError,
} from './timeCalc'

function evalTime(formula: string) {
  const v = evaluate(formula)
  if (v.kind !== 'time') throw new Error(`expected time, got ${v.kind}`)
  return formatTime(v.seconds)
}

function evalNumber(formula: string) {
  const v = evaluate(formula)
  if (v.kind !== 'number') throw new Error(`expected number, got ${v.kind}`)
  return formatNumber(v.value)
}

describe('evaluate', () => {
  it('adds two times', () => {
    expect(evalTime('1:30+3:45')).toEqual({ text: '5:15', hasSubSecond: false })
  })

  it('subtracts two times into a negative result', () => {
    expect(evalTime('2:59-3:00')).toEqual({ text: '-0:01', hasSubSecond: false })
  })

  it('multiplies a time by a number', () => {
    expect(evalTime('0:15*4')).toEqual({ text: '1:00', hasSubSecond: false })
  })

  it('divides a time by a number', () => {
    expect(evalTime('3:00/2')).toEqual({ text: '1:30', hasSubSecond: false })
  })

  it('divides a time by a time into a plain number', () => {
    expect(evalNumber('1:00/0:15')).toBe('4')
  })

  it('computes plain numeric arithmetic with parens', () => {
    expect(evalNumber('(5-3)*(1+4)')).toBe('10')
  })

  it('handles mixed time/number/parens with a sub-second remainder', () => {
    const result = evalTime('40:00/7*31')
    expect(result.text).toBe('177:08:34')
    expect(result.hasSubSecond).toBe(true)
  })

  it('shows H:MM:SS with the seconds underlined even when the rounded seconds are 0', () => {
    // 0:00:01 を7で割った端数（秒未満）が乗るが、丸めた合計秒はちょうど 3:00:00 になる
    const result = evalTime('3:00:00+0:00:01/7')
    expect(result.text).toBe('3:00:00')
    expect(result.hasSubSecond).toBe(true)
  })

  it('parses and mixes H:MM and H:MM:SS in the same formula', () => {
    expect(evalTime('1:30+0:00:45')).toEqual({ text: '1:30:45', hasSubSecond: false })
  })

  it('rejects an incomplete second component', () => {
    expect(() => evaluate('1:30:5+1:00')).toThrow(TimeCalcError)
  })

  it('supports leading unary minus on a time', () => {
    expect(evalTime('-1:00+2:30')).toEqual({ text: '1:30', hasSubSecond: false })
  })

  it('rejects mixing time and number with +', () => {
    expect(() => evaluate('1:00+1')).toThrow(TimeCalcError)
  })

  it('rejects multiplying two times', () => {
    expect(() => evaluate('1:00*2:00')).toThrow(TimeCalcError)
  })

  it('rejects dividing a number by a time', () => {
    expect(() => evaluate('1/1:00')).toThrow(TimeCalcError)
  })

  it('rejects division by zero', () => {
    expect(() => evaluate('1:00/0')).toThrow(TimeCalcError)
  })

  it('rejects an incomplete minute component', () => {
    expect(() => evaluate('1:3+1:00')).toThrow(TimeCalcError)
  })

  it('multiplies a time by a decimal number', () => {
    expect(evalTime('1:00*0.5')).toEqual({ text: '0:30', hasSubSecond: false })
  })

  it('computes plain decimal arithmetic', () => {
    expect(evalNumber('0.1+0.2')).toBe('0.3')
  })

  it('supports a leading unary minus on a decimal number', () => {
    expect(evalNumber('-0.5+1')).toBe('0.5')
  })
})

describe('prettyFormula', () => {
  it('renders * and / as × and ÷ with spacing', () => {
    expect(prettyFormula('40:00/7*31')).toBe('40:00 ÷ 7 × 31')
  })

  it('keeps a leading unary minus tight against its value', () => {
    expect(prettyFormula('-3:00+1:00')).toBe('-3:00 + 1:00')
  })

  it('keeps a unary minus after an open paren tight', () => {
    expect(prettyFormula('(-3:00+1:00)*2')).toBe('(-3:00 + 1:00) × 2')
  })
})

describe('prettyCursorIndex', () => {
  it('maps 1:1 when there is no spacing to add', () => {
    expect(prettyCursorIndex('123', 0)).toBe(0)
    expect(prettyCursorIndex('123', 2)).toBe(2)
    expect(prettyCursorIndex('123', 3)).toBe(3)
  })

  it('shifts positions after a spaced-out operator', () => {
    // '1+2' -> '1 + 2'
    expect(prettyCursorIndex('1+2', 0)).toBe(0) // '1' の前
    expect(prettyCursorIndex('1+2', 1)).toBe(1) // '1' の後、'+' の前
    expect(prettyCursorIndex('1+2', 2)).toBe(4) // '+' の後、'2' の前
    expect(prettyCursorIndex('1+2', 3)).toBe(5) // 末尾
  })

  it('keeps a leading unary minus tight against its value', () => {
    // '-3:00+1:00' -> '-3:00 + 1:00'
    expect(prettyCursorIndex('-3:00+1:00', 0)).toBe(0)
    expect(prettyCursorIndex('-3:00+1:00', 1)).toBe(1)
  })

  it('clamps a trailing operator position to the trimmed text length', () => {
    // '1:00+' -> '1:00 + ' -> trimmed to '1:00 +'
    expect(prettyCursorIndex('1:00+', 5)).toBe('1:00 +'.length)
  })
})

describe('formulaIndexFromPrettyIndex', () => {
  it('is the inverse of prettyCursorIndex when there is no spacing to add', () => {
    expect(formulaIndexFromPrettyIndex('123', 0)).toBe(0)
    expect(formulaIndexFromPrettyIndex('123', 2)).toBe(2)
    expect(formulaIndexFromPrettyIndex('123', 3)).toBe(3)
  })

  it('resolves a tap inside a spaced-out operator to the nearer side', () => {
    // '1+2' -> '1 + 2'（インデックス: 0='1'の前, 1='1'の後/空白の前, 4=空白の後/'2'の前, 5=末尾）
    expect(formulaIndexFromPrettyIndex('1+2', 0)).toBe(0)
    expect(formulaIndexFromPrettyIndex('1+2', 1)).toBe(1) // '1'の直後をタップ
    expect(formulaIndexFromPrettyIndex('1+2', 2)).toBe(1) // '+'の左半分をタップ → '+'の前
    expect(formulaIndexFromPrettyIndex('1+2', 3)).toBe(2) // '+'の右半分をタップ → '+'の後
    expect(formulaIndexFromPrettyIndex('1+2', 4)).toBe(2) // '2'の直前をタップ
    expect(formulaIndexFromPrettyIndex('1+2', 5)).toBe(3) // 末尾をタップ
  })

  it('round-trips through prettyCursorIndex for every cursor position', () => {
    for (const formula of ['123', '1+2', '-3:00+1:00', '(-3:00+1:00)*2', '40:00/7*31']) {
      for (let pos = 0; pos <= formula.length; pos++) {
        expect(formulaIndexFromPrettyIndex(formula, prettyCursorIndex(formula, pos))).toBe(pos)
      }
    }
  })
})
