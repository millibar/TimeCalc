// 時間数式の計算エンジン。
// 値には「時間 (time, 内部は秒で保持)」と「数値 (number)」の2種類があり、
// 演算子ごとに組み合わせ可能な型が決まる。

export type TimeValue = { kind: 'time'; seconds: number }
export type NumberValue = { kind: 'number'; value: number }
export type Value = TimeValue | NumberValue

export class TimeCalcError extends Error {}

const time = (seconds: number): TimeValue => ({ kind: 'time', seconds })
const num = (value: number): NumberValue => ({ kind: 'number', value })

// --- Tokenizer -------------------------------------------------------

type Token =
  | { type: 'time'; seconds: number }
  | { type: 'number'; value: number }
  | { type: 'op'; op: '+' | '-' | '*' | '/' }
  | { type: 'lparen' }
  | { type: 'rparen' }

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const c = input[i]
    if (c === ' ' || c === '\t' || c === '\n') {
      i++
      continue
    }
    if (c === '(') {
      tokens.push({ type: 'lparen' })
      i++
      continue
    }
    if (c === ')') {
      tokens.push({ type: 'rparen' })
      i++
      continue
    }
    if (c === '+' || c === '-' || c === '*' || c === '/') {
      tokens.push({ type: 'op', op: c })
      i++
      continue
    }
    if (/\d/.test(c)) {
      const start = i
      while (i < input.length && /\d/.test(input[i])) i++
      if (input[i] === ':') {
        i++
        const minuteStart = i
        while (i < input.length && /\d/.test(input[i])) i++
        const hours = input.slice(start, minuteStart - 1)
        const minutes = input.slice(minuteStart, i)
        if (minutes.length !== 2) {
          throw new TimeCalcError(`不正な時間表記です: ${input.slice(start, i)}`)
        }
        const seconds = Number(hours) * 3600 + Number(minutes) * 60
        tokens.push({ type: 'time', seconds })
      } else {
        // 小数点はプレーンな数値のみで使える（時間は H:MM 形式のみ）
        if (input[i] === '.') {
          i++
          while (i < input.length && /\d/.test(input[i])) i++
        }
        tokens.push({ type: 'number', value: Number(input.slice(start, i)) })
      }
      continue
    }
    throw new TimeCalcError(`不正な文字です: ${c}`)
  }
  return tokens
}

// --- Parser (再帰下降) ------------------------------------------------
// expr := term (('+' | '-') term)*
// term := unary (('*' | '/') unary)*
// unary := '-' unary | atom
// atom := TIME | NUMBER | '(' expr ')'

class Parser {
  private tokens: Token[]
  private pos = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  parse(): Value {
    if (this.tokens.length === 0) {
      throw new TimeCalcError('式が空です')
    }
    const result = this.parseExpr()
    if (this.pos !== this.tokens.length) {
      throw new TimeCalcError('式の末尾に余分な文字があります')
    }
    return result
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private parseExpr(): Value {
    let left = this.parseTerm()
    for (;;) {
      const t = this.peek()
      if (t?.type === 'op' && (t.op === '+' || t.op === '-')) {
        this.pos++
        const right = this.parseTerm()
        left = t.op === '+' ? add(left, right) : subtract(left, right)
      } else {
        break
      }
    }
    return left
  }

  private parseTerm(): Value {
    let left = this.parseUnary()
    for (;;) {
      const t = this.peek()
      if (t?.type === 'op' && (t.op === '*' || t.op === '/')) {
        this.pos++
        const right = this.parseUnary()
        left = t.op === '*' ? multiply(left, right) : divide(left, right)
      } else {
        break
      }
    }
    return left
  }

  private parseUnary(): Value {
    const t = this.peek()
    if (t?.type === 'op' && t.op === '-') {
      this.pos++
      const v = this.parseUnary()
      return negate(v)
    }
    return this.parseAtom()
  }

  private parseAtom(): Value {
    const t = this.peek()
    if (!t) {
      throw new TimeCalcError('値が必要です')
    }
    if (t.type === 'time') {
      this.pos++
      return time(t.seconds)
    }
    if (t.type === 'number') {
      this.pos++
      return num(t.value)
    }
    if (t.type === 'lparen') {
      this.pos++
      const v = this.parseExpr()
      const close = this.peek()
      if (close?.type !== 'rparen') {
        throw new TimeCalcError('括弧が閉じられていません')
      }
      this.pos++
      return v
    }
    throw new TimeCalcError('不正な式です')
  }
}

// --- 型ごとの演算規則 ---------------------------------------------------

function add(a: Value, b: Value): Value {
  if (a.kind === 'time' && b.kind === 'time') return time(a.seconds + b.seconds)
  if (a.kind === 'number' && b.kind === 'number') return num(a.value + b.value)
  throw new TimeCalcError('時間と数値は加算できません')
}

function subtract(a: Value, b: Value): Value {
  if (a.kind === 'time' && b.kind === 'time') return time(a.seconds - b.seconds)
  if (a.kind === 'number' && b.kind === 'number') return num(a.value - b.value)
  throw new TimeCalcError('時間と数値は減算できません')
}

function multiply(a: Value, b: Value): Value {
  if (a.kind === 'time' && b.kind === 'number') return time(a.seconds * b.value)
  if (a.kind === 'number' && b.kind === 'time') return time(a.value * b.seconds)
  if (a.kind === 'number' && b.kind === 'number') return num(a.value * b.value)
  throw new TimeCalcError('時間同士は乗算できません')
}

function divide(a: Value, b: Value): Value {
  if (a.kind === 'time' && b.kind === 'number') {
    if (b.value === 0) throw new TimeCalcError('0で割ることはできません')
    return time(a.seconds / b.value)
  }
  if (a.kind === 'time' && b.kind === 'time') {
    if (b.seconds === 0) throw new TimeCalcError('0で割ることはできません')
    return num(a.seconds / b.seconds)
  }
  if (a.kind === 'number' && b.kind === 'number') {
    if (b.value === 0) throw new TimeCalcError('0で割ることはできません')
    return num(a.value / b.value)
  }
  throw new TimeCalcError('数値を時間で割ることはできません')
}

function negate(v: Value): Value {
  return v.kind === 'time' ? time(-v.seconds) : num(-v.value)
}

// --- 公開API ----------------------------------------------------------

export function evaluate(formula: string): Value {
  const tokens = tokenize(formula)
  return new Parser(tokens).parse()
}

export interface FormattedTime {
  /** 符号込みの "H:MM" 表示 */
  text: string
  /** 分未満の端数（秒）が残っているか */
  hasSubMinute: boolean
}

/** 時間の合計秒数を "H:MM" 形式に整形する。分未満は最も近い秒に丸めて端数の有無を判定する。 */
export function formatTime(totalSeconds: number): FormattedTime {
  const rounded = Math.round(totalSeconds)
  const sign = rounded < 0 ? '-' : ''
  const abs = Math.abs(rounded)
  const hours = Math.floor(abs / 3600)
  const minutes = Math.floor((abs % 3600) / 60)
  const seconds = abs % 60
  const text = `${sign}${hours}:${String(minutes).padStart(2, '0')}`
  return { text, hasSubMinute: seconds !== 0 }
}

export function formatNumber(value: number): string {
  // 誤差で出る極小の小数を丸めて表示する
  const rounded = Math.round(value * 1e6) / 1e6
  return String(rounded)
}

/**
 * prettyFormula の整形処理本体。
 * indexMap[i] は「元の formula の i 文字目の直前」が、整形後の文字列（トリム前）の
 * どの位置に対応するかを表す。カーソル位置の変換に使う。
 */
function buildPrettyFormula(formula: string): { text: string; indexMap: number[] } {
  let out = ''
  const indexMap: number[] = [0]
  for (let i = 0; i < formula.length; i++) {
    const c = formula[i]
    if (c === '*' || c === '/') {
      out += ` ${c === '*' ? '×' : '÷'} `
    } else if (c === '+' || c === '-') {
      const prev = out.trimEnd()
      const isUnary = prev === '' || /[+\-×÷(]$/.test(prev)
      out += isUnary ? c : ` ${c} `
    } else {
      out += c
    }
    indexMap.push(out.length)
  }
  return { text: out.replace(/\s+/g, ' ').trim(), indexMap }
}

/** ボタン入力で組み立てた数式文字列を、電卓表示用に ×÷ とスペースで整形する */
export function prettyFormula(formula: string): string {
  return buildPrettyFormula(formula).text
}

/**
 * 元の formula 文字列上のカーソル位置（cursorPos 文字目の直前）を、
 * prettyFormula() が返す整形後の表示文字列上の位置に変換する。
 * 数式表示をタップしてカーソルを移動する機能を実装する際は、
 * 逆方向（表示位置→formula 位置）の変換をこのマッピングを元に追加する想定。
 */
export function prettyCursorIndex(formula: string, cursorPos: number): number {
  const { text, indexMap } = buildPrettyFormula(formula)
  const clampedPos = Math.max(0, Math.min(cursorPos, formula.length))
  return Math.min(indexMap[clampedPos], text.length)
}
