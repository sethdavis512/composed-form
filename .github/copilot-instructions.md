# Copilot Instructions for composed-form

A React library for building multi-step wizard forms with per-step validation, built on top of `react-hook-form` and Zod.

## Commands

```bash
bun install          # Install dependencies
bun run build        # Build with tsdown
bun run dev          # Build in watch mode
bun test             # Run all tests
bun test <file>      # Run a specific test file (e.g., bun test steps.test.ts)
bun run example      # Run the basic example app
```

## Architecture

**Core components:**
- `<ComposedForm>` — Root provider that wraps `react-hook-form`'s `FormProvider`. Manages step registration, navigation state, and per-step validation. Accepts either a Zod `schema` or a custom `resolver`.
- `<Step name="...">` — Declares a wizard step. Steps register themselves on mount and auto-track which fields belong to them. Children are always rendered (hidden when inactive) to preserve RHF field state.

**Hooks:**
- `useComposedFormContext()` — Enhanced version of `useFormContext` with navigation methods (`goToNextStep`, `goToPreviousStep`, `goToStep`, `submitStep`) and step state. The `register` function is wrapped to automatically track fields per step.
- `useStep()` — Returns step metadata (position, count, `isFirstStep`, `isLastStep`) for building progress indicators.

**Key patterns:**
- Steps can be conditionally enabled via `<Step enabled={condition}>`. Disabled steps are skipped during navigation.
- Navigation validates only the current step's fields before advancing (using `form.trigger()`).
- The `onSubmitStep` callback fires after each step validates, receiving that step's partial values.
- Final submission triggers `onSubmit` with the complete form values.

## Conventions

- Use Bun for all commands (not npm/node)
- TypeScript with `.ts`/`.tsx` extensions in imports
- Exports are re-exported through `src/index.ts`
- Tests use `bun:test` and live in `src/__tests__/`
- Internal APIs are prefixed with underscore (e.g., `_registerStep`)
