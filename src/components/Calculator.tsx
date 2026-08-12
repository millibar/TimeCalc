import { useState } from 'react'
import { applyButton, initialState, type Button } from '../lib/calculatorInput'
import { formatNumber, formatTime, prettyFormula } from '../lib/timeCalc'
import './Calculator.css'

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

const KEYS: { label: string; btn: Button; className?: string }[][] = [
  [
    { label: 'AC', btn: { type: 'ac' }, className: 'ac' },
    { label: '(', btn: { type: 'lparen' } },
    { label: ')', btn: { type: 'rparen' } },
    { label: '⌫', btn: { type: 'backspace' } },
  ],
  [
    { label: '7', btn: { type: 'digit', d: '7' } },
    { label: '8', btn: { type: 'digit', d: '8' } },
    { label: '9', btn: { type: 'digit', d: '9' } },
    { label: '÷', btn: { type: 'op', op: '/' }, className: 'op' },
  ],
  [
    { label: '4', btn: { type: 'digit', d: '4' } },
    { label: '5', btn: { type: 'digit', d: '5' } },
    { label: '6', btn: { type: 'digit', d: '6' } },
    { label: '×', btn: { type: 'op', op: '*' }, className: 'op' },
  ],
  [
    { label: '1', btn: { type: 'digit', d: '1' } },
    { label: '2', btn: { type: 'digit', d: '2' } },
    { label: '3', btn: { type: 'digit', d: '3' } },
    { label: '−', btn: { type: 'op', op: '-' }, className: 'op' },
  ],
  [
    { label: '0', btn: { type: 'digit', d: '0' } },
    { label: ':', btn: { type: 'colon' } },
    { label: '=', btn: { type: 'equals' }, className: 'equals' },
    { label: '+', btn: { type: 'op', op: '+' }, className: 'op' },
  ],
]

export default function Calculator() {
  const [state, setState] = useState(initialState)

  return (
    <div className="calculator">
      <div className="display">
        <div className="display-formula">{prettyFormula(state.formula) || ' '}</div>
        <ResultDisplay state={state} />
      </div>
      <div className="keypad">
        {KEYS.flat().map((k) => (
          <button
            key={k.label}
            type="button"
            className={`key${k.className ? ` ${k.className}` : ''}`}
            onClick={() => setState((s) => applyButton(s, k.btn))}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  )
}
