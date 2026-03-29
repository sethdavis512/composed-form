## Project Overview

React library for building multi-step forms (wizards) on top of React Hook Form and Zod. Publishes ESM + CJS to npm with full type declarations.

## Stack

- **Runtime**: Bun
- **Build**: tsdown (ESM + CJS + `.d.ts`)
- **Test**: `bun test` with `@testing-library/react` and `happy-dom`
- **Versioning/Publishing**: Changesets (`bun run changeset`, `bun run release`)
- **CI**: GitHub Actions (`.github/workflows/release.yml`)

## Commands

- `bun run build` -- build to `dist/`
- `bun test` -- run all tests
- `bun run dev` -- watch mode build
- `bun run changeset` -- create a changeset for versioning
- `bun run release` -- build + publish to npm
- `bun run example` -- run the basic example

## Architecture

- `src/ComposedForm.tsx` -- root component, wraps React Hook Form's `FormProvider`
- `src/Step.tsx` -- step component, registers with wizard via context; supports `enabledWhen` predicate for reactive conditional steps
- `src/hooks/useComposedFormContext.ts` -- single hook for all wizard state (navigation, step metadata, step-aware `register`)
- `src/utils/resolver.ts` -- thin wrapper around `@hookform/resolvers/zod`
- `src/utils/steps.ts` -- pure functions for step navigation logic
- `examples/basic/` and `examples/advanced/` -- example apps (Bun.serve + HTML imports)

## Public API

- Navigation: `next()`, `back()`, `goTo(name)`
- Step metadata: `stepCount`, `stepPosition`, `isFirstStep`, `isLastStep`, `currentStepName`
- Conditional steps: `<Step enabledWhen={(v) => v.plan === 'pro'}>` (reactive) or `<Step enabled={bool}>` (static)

## Dependencies

- `dependencies`: none (all peer deps)
- `peerDependencies`: `react`, `react-hook-form`, `@hookform/resolvers`, `zod`
- `devDependencies`: testing libs, build tools, type packages

## Testing

Tests live in `src/__tests__/`. Two test files:
- `steps.test.ts` -- unit tests for step navigation utilities
- `integration.test.tsx` -- component/hook integration tests with `@testing-library/react`

DOM environment is provided by `happy-dom` via `bunfig.toml` preload.
