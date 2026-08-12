# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository status

TimeCalc is a calculator-style PWA for evaluating expressions that mix time durations (`H:MM`) and plain numbers — e.g. `1:30 + 3:45`, `40:00 / 7 * 31`. Built with Vite + React + TypeScript.

## Commands

- `npm run dev` — start the Vite dev server.
- `npm run build` — typecheck (`tsc -b`) and produce a production build in `dist/`.
- `npm run preview` — serve the production build locally.
- `npm test` — run the Vitest unit tests (`npm test -- --watch` to watch).
- `npm run lint` — run ESLint.

## Architecture

- `src/lib/timeCalc.ts` — the calculation engine: tokenizer, recursive-descent parser, and evaluator over a small typed `Value` union (`{ kind: 'time'; seconds }` or `{ kind: 'number'; value }`). Arithmetic rules are type-checked per operator (e.g. `time / time → number`, `time + number` is a `TimeCalcError`). Time is stored internally in seconds even though input/display is currently `H:MM`-only, so a future seconds-in-the-UI feature doesn't require touching the engine. Also has `formatTime`/`formatNumber` (result formatting, including the sub-minute-remainder flag) and `prettyFormula` (×/÷ display formatting).
- `src/lib/calculatorInput.ts` — a pure state machine (`applyButton(state, button) → state`) that builds up a formula string from calculator button presses, validating input as it goes (balanced parens, complete `H:MM` tokens, no implicit multiplication, unary minus, chaining a new expression off the previous result after `=`). Kept separate from `timeCalc.ts` so input UX logic and arithmetic semantics can be tested independently.
- `src/components/Calculator.tsx` — the button grid and display; renders the result with the sub-minute-remainder minutes underlined.
- Both `src/lib/*.ts` files have Vitest coverage (`*.test.ts`) exercising the worked examples from the spec (sign handling, mixed-type errors, division by zero, sub-minute rounding, etc.) and the button-input edge cases.
- PWA config (manifest, icons, service worker via `vite-plugin-pwa`) lives in `vite.config.ts`; icon source SVGs are not kept in the repo, only the generated PNGs under `public/icons/`.

## Known limitations / future work

- Seconds input/display is intentionally not exposed in the UI yet (per spec), though the engine already carries sub-minute precision through calculations.
- Keyboard input is not implemented; button-only for now.

## Dev environment

- `.devcontainer/Dockerfile` — based on `mcr.microsoft.com/devcontainers/typescript-node:1-20-bullseye` (Node 20), with `ripgrep`, `curl`, `git`, and `@anthropic-ai/claude-code` installed globally.
- `.devcontainer/devcontainer.json` — mounts a shared `.claude` config directory from the host (`~/workspace/.claude`) into the container at `/workspace_shared/.claude`, then symlinks it to `./.claude` via `postCreateCommand`. It also mounts the host's `~/.claude.json` into the container.
