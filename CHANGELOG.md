# composed-form

## 0.3.0

### Minor Changes

- e4af15b: Simplified the public API to reduce cognitive load and improve developer experience.

  **Breaking changes:**

  - Removed `useStep` hook. Its fields (`stepCount`, `stepPosition`) are now on `useComposedFormContext()`.
  - Renamed navigation methods: `submitStep` -> `next`, `goToPreviousStep` -> `back`, `goToStep` -> `goTo`.
  - Removed `goToNextStep` (redundant with `next`, which also handles final submission).
  - Removed `useFormContext` re-export to avoid confusion with `useComposedFormContext`.

  **New:**

  - `enabledWhen` prop on `<Step>` for reactive conditional steps without watcher components or state management. Example: `<Step name="billing" enabledWhen={(v) => v.plan === 'pro'}>`.

## 0.2.0

### Minor Changes

- c17bf72: Initial publish: React multi-step form wizard built on React Hook Form and Zod with per-step validation, conditional steps, cross-step dependencies, and step navigation.
