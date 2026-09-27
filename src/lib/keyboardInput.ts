// 物理キーボードのキー入力を電卓ボタン（Button）に対応付ける。
// 対応表は docs/spec.md「キーボードからの入力」を参照。
//
// キーボード配列（JIS/US等）に依存しないよう、KeyboardEvent.code ではなく
// 実際に入力される文字（KeyboardEvent.key）で判定する。

import type { Button } from './calculatorInput'

/** buttonFromKey() が参照する KeyboardEvent のプロパティ。 */
export type KeyInput = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey' | 'isComposing'>

const KEY_MAP: Record<string, Button> = {
  ':': { type: 'colon' },
  '.': { type: 'decimal' },
  '+': { type: 'op', op: '+' },
  '-': { type: 'op', op: '-' },
  '*': { type: 'op', op: '*' },
  '/': { type: 'op', op: '/' },
  '(': { type: 'lparen' },
  ')': { type: 'rparen' },
  Enter: { type: 'equals' },
  '=': { type: 'equals' },
  Backspace: { type: 'backspace' },
  Escape: { type: 'ac' },
  ArrowLeft: { type: 'left' },
  ArrowRight: { type: 'right' },
}

/**
 * キー入力に対応するボタンを返す。電卓の入力として扱わないキーなら null。
 * Ctrl/Alt/Meta との組み合わせはブラウザのショートカットに任せるため null を返す
 * （Shift は `:` `+` `*` `(` `)` などの入力に必要なので無視しない）。
 * IME変換中の入力も null を返す。
 */
export function buttonFromKey(e: KeyInput): Button | null {
  if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return null
  if (/^[0-9]$/.test(e.key)) return { type: 'digit', d: e.key }
  return KEY_MAP[e.key] ?? null
}
