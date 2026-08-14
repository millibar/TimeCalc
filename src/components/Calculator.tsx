import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { applyButton, initialState, type Button } from '../lib/calculatorInput'
import {
  formatNumber,
  formatTime,
  formulaIndexFromPrettyIndex,
  prettyCursorIndex,
  prettyFormula,
} from '../lib/timeCalc'
import './Calculator.css'

/**
 * 数式表示エリア上のタップ位置（クライアント座標）から、その地点に最も近い
 * 文字境界を求め、prettyFormula() の表示文字列上でのインデックスとして返す。
 * caretRangeFromPoint / caretPositionFromPoint が使えない環境では null を返す。
 */
function prettyIndexAtPoint(root: HTMLElement, clientX: number, clientY: number): number | null {
  const doc = root.ownerDocument as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  }
  let node: Node | null = null
  let offset = 0
  if (doc.caretRangeFromPoint) {
    const range = doc.caretRangeFromPoint(clientX, clientY)
    if (!range) return null
    node = range.startContainer
    offset = range.startOffset
  } else if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(clientX, clientY)
    if (!pos) return null
    node = pos.offsetNode
    offset = pos.offset
  } else {
    return null
  }
  if (!root.contains(node)) return null
  // root の先頭から (node, offset) までを Range で切り取り、その文字列長を数えることで
  // 要素の入れ子（before/cursor/after の span）に関係なく文字インデックスに変換できる。
  const measureRange = doc.createRange()
  measureRange.setStart(root, 0)
  measureRange.setEnd(node, offset)
  return measureRange.toString().length
}

function ResultDisplay({ state }: { state: ReturnType<typeof applyButton> }) {
  if (state.error) {
    return <div className="display-result is-error">{state.error}</div>
  }
  if (!state.result) {
    return <div className="display-result">&nbsp;</div>
  }
  if (state.result.kind === 'number') {
    return <div className="display-result">{formatNumber(state.result.value)}</div>
  }
  const { text, hasSubMinute } = formatTime(state.result.seconds)
  const match = /^(-?\d+:)(\d{2})$/.exec(text)
  if (!match) return <div className="display-result">{text}</div>
  const [, prefix, minutes] = match
  return (
    <div className="display-result">
      {prefix}
      <span className={hasSubMinute ? 'sub-minute' : undefined}>{minutes}</span>
    </div>
  )
}

/** 数式を整形した表示文字列の中に、点滅するカーソルを差し込んで描画する。 */
function FormulaDisplay({
  formula,
  cursorPos,
  onTap,
}: {
  formula: string
  cursorPos: number
  onTap: (formulaPos: number) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const text = prettyFormula(formula)
  const cursorIndex = prettyCursorIndex(formula, cursorPos)
  const before = text.slice(0, cursorIndex)
  const after = text.slice(cursorIndex)

  function handleClick(e: ReactMouseEvent<HTMLDivElement>) {
    const root = rootRef.current
    if (!root) return
    const prettyIndex = prettyIndexAtPoint(root, e.clientX, e.clientY)
    if (prettyIndex === null) return
    onTap(formulaIndexFromPrettyIndex(formula, prettyIndex))
  }

  return (
    <div className="display-formula" ref={rootRef} onClick={handleClick}>
      <span>{before}</span>
      <span className="cursor" />
      <span>{after}</span>
    </div>
  )
}

// btn に配列を渡すと、その順にボタンを連続して押したものとして扱う（「00」を「0」2回として扱うなど）。
type Key = { label: string; btn: Button | Button[]; className?: string } | null

const KEYS: Key[][] = [
  [
    { label: 'AC', btn: { type: 'ac' }, className: 'ac' },
    { label: '←', btn: { type: 'left' }, className: 'nav' },
    { label: '→', btn: { type: 'right' }, className: 'nav' },
    { label: '⌫', btn: { type: 'backspace' } },
  ],
  [
    {
      label: '00',
      btn: [
        { type: 'digit', d: '0' },
        { type: 'digit', d: '0' },
      ],
    },
    { label: '(', btn: { type: 'lparen' } },
    { label: ')', btn: { type: 'rparen' } },
    { label: '÷', btn: { type: 'op', op: '/' }, className: 'op' },
  ],
  [
    { label: '7', btn: { type: 'digit', d: '7' } },
    { label: '8', btn: { type: 'digit', d: '8' } },
    { label: '9', btn: { type: 'digit', d: '9' } },
    { label: '×', btn: { type: 'op', op: '*' }, className: 'op' },
  ],
  [
    { label: '4', btn: { type: 'digit', d: '4' } },
    { label: '5', btn: { type: 'digit', d: '5' } },
    { label: '6', btn: { type: 'digit', d: '6' } },
    { label: '−', btn: { type: 'op', op: '-' }, className: 'op' },
  ],
  [
    { label: '1', btn: { type: 'digit', d: '1' } },
    { label: '2', btn: { type: 'digit', d: '2' } },
    { label: '3', btn: { type: 'digit', d: '3' } },
    { label: '+', btn: { type: 'op', op: '+' }, className: 'op' },
  ],
  [
    { label: '0', btn: { type: 'digit', d: '0' } },
    { label: '：', btn: { type: 'colon' } },
    { label: '.', btn: { type: 'decimal' }, className: 'decimal' },
    { label: '=', btn: { type: 'equals' }, className: 'equals' },
  ],
]

export default function Calculator() {
  const [state, setState] = useState(initialState)

  return (
    <div className="calculator">
      <div className="display">
        <FormulaDisplay
          formula={state.formula}
          cursorPos={state.cursorPos}
          onTap={(pos) => setState((s) => applyButton(s, { type: 'setCursor', pos }))}
        />
        <ResultDisplay state={state} />
      </div>
      <div className="keypad">
        {KEYS.flat().map((k, i) =>
          k === null ? (
            <div key={`blank-${i}`} className="key key-blank" aria-hidden="true" />
          ) : (
            <button
              key={`key-${i}`}
              type="button"
              className={`key${k.className ? ` ${k.className}` : ''}`}
              onClick={() =>
                setState((s) => (Array.isArray(k.btn) ? k.btn : [k.btn]).reduce(applyButton, s))
              }
            >
              {k.label}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
