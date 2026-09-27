import { describe, expect, it } from 'vitest'
import { applyButton, initialState } from './calculatorInput'
import { buttonFromKey, type KeyInput } from './keyboardInput'

function key(k: string, mods: Partial<KeyInput> = {}): KeyInput {
  return { key: k, ctrlKey: false, altKey: false, metaKey: false, isComposing: false, ...mods }
}

describe('buttonFromKey', () => {
  it('数字キーは対応する数字ボタンになる', () => {
    for (const d of '0123456789') {
      expect(buttonFromKey(key(d))).toEqual({ type: 'digit', d })
    }
  })

  it.each([
    [':', { type: 'colon' }],
    ['.', { type: 'decimal' }],
    ['+', { type: 'op', op: '+' }],
    ['-', { type: 'op', op: '-' }],
    ['*', { type: 'op', op: '*' }],
    ['/', { type: 'op', op: '/' }],
    ['(', { type: 'lparen' }],
    [')', { type: 'rparen' }],
    ['Enter', { type: 'equals' }],
    ['=', { type: 'equals' }],
    ['Backspace', { type: 'backspace' }],
    ['Escape', { type: 'ac' }],
    ['ArrowLeft', { type: 'left' }],
    ['ArrowRight', { type: 'right' }],
  ])('%s キーはボタンに対応する', (k, expected) => {
    expect(buttonFromKey(key(k))).toEqual(expected)
  })

  it('対応表にないキーは null', () => {
    for (const k of ['a', ';', ',', 'Delete', 'Tab', ' ', 'ArrowUp', 'ArrowDown', 'Shift', '１', '：']) {
      expect(buttonFromKey(key(k))).toBeNull()
    }
  })

  it('Ctrl/Alt/Meta との組み合わせは null（ブラウザのショートカットに任せる）', () => {
    expect(buttonFromKey(key('1', { ctrlKey: true }))).toBeNull()
    expect(buttonFromKey(key('+', { altKey: true }))).toBeNull()
    expect(buttonFromKey(key('Backspace', { metaKey: true }))).toBeNull()
  })

  it('IME変換中の入力は null', () => {
    expect(buttonFromKey(key('1', { isComposing: true }))).toBeNull()
  })

  it('キー入力を順に適用すると数式を組み立てて計算できる', () => {
    const keys = ['1', ':', '3', '0', '+', '3', ':', '4', '5', 'Enter']
    const state = keys.reduce((s, k) => {
      const btn = buttonFromKey(key(k))
      return btn ? applyButton(s, btn) : s
    }, initialState)
    expect(state.result).toEqual({ kind: 'time', seconds: 5 * 3600 + 15 * 60 })
  })
})
