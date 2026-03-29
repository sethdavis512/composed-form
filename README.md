# composed-form

A React library for building multi-step forms (wizards) on top of [React Hook Form](https://react-hook-form.com/) and [Zod](https://zod.dev/).

Define one Zod schema for the entire form, split fields across `<Step>` components, and let composed-form handle per-step validation, conditional steps, cross-step dependencies, and navigation.

## Install

```bash
bun install composed-form
```

Peer dependencies:

```bash
bun install react react-hook-form @hookform/resolvers zod
```

## Quick start

```tsx
import { z } from 'zod';
import { ComposedForm, Step, useComposedFormContext } from 'composed-form';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email(),
});

function NameStep() {
  const { register, formState: { errors } } = useComposedFormContext();
  return (
    <>
      <input {...register('name')} />
      {errors.name && <p>{errors.name.message}</p>}
    </>
  );
}

function EmailStep() {
  const { register, formState: { errors } } = useComposedFormContext();
  return (
    <>
      <input {...register('email')} />
      {errors.email && <p>{errors.email.message}</p>}
    </>
  );
}

function Nav() {
  const { back, next, isFirstStep, isLastStep } = useComposedFormContext();
  return (
    <div>
      <button onClick={back} disabled={isFirstStep}>Back</button>
      <button onClick={() => void next()}>
        {isLastStep ? 'Submit' : 'Next'}
      </button>
    </div>
  );
}

function App() {
  return (
    <ComposedForm schema={schema} onSubmit={(data) => console.log(data)}>
      <Step name="name"><NameStep /></Step>
      <Step name="email"><EmailStep /></Step>
      <Nav />
    </ComposedForm>
  );
}
```

## Features

### Per-step validation

When advancing to the next step, only the current step's registered fields are validated. A bad value in step 3 does not block step 1.

Under the hood, `useComposedFormContext().register` tracks which fields belong to each `<Step>`. On advance, the library calls `form.trigger(fieldNames)` with only the current step's fields.

### Cross-step field dependencies

Use Zod's `.refine()` to validate fields that depend on each other across steps. Target the error to the right step using the `path` option:

```tsx
const schema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'], // error lands on the step that owns confirmPassword
  });
```

### Conditional steps

Toggle entire steps on or off with `enabledWhen`. Pass a predicate that receives the current form values and returns whether the step should be active. Disabled steps are skipped during navigation and their fields are excluded from step validation.

```tsx
<ComposedForm schema={schema} onSubmit={handleSubmit}>
  <Step name="plan"><PlanStep /></Step>
  <Step name="billing" enabledWhen={(v) => v.plan === 'pro'}>
    <BillingStep />
  </Step>
  <Step name="review"><ReviewStep /></Step>
</ComposedForm>
```

The predicate re-evaluates whenever form values change, so the step toggles reactively without any watcher components or state management.

For simple static cases, you can also use the `enabled` boolean prop directly. When both are provided, `enabledWhen` takes precedence.

Steps are always mounted in the DOM (hidden via `display: none`) so React Hook Form field state is preserved. When a step is disabled, it simply gets skipped during navigation.

### Conditional fields within a step

Use `useWatch` to show or hide fields inside a single step:

```tsx
import { useWatch, useComposedFormContext } from 'composed-form';

function AddressStep() {
  const { register } = useComposedFormContext();
  const country = useWatch({ name: 'country' });

  return (
    <>
      <select {...register('country')}>...</select>
      {country === 'US' && <input {...register('state')} />}
    </>
  );
}
```

### Step navigation

`useComposedFormContext()` exposes these navigation methods:

- `next()` -- validates current step, calls `onSubmitStep` if provided, then advances. On the last enabled step, calls `onSubmit` instead. Returns `Promise<boolean>`.
- `back()` -- goes back without validation.
- `goTo(name)` -- jumps to a specific step by name (no validation).

### Per-step submit callback

Use `onSubmitStep` to run side effects (save draft, analytics, etc.) each time a step validates successfully:

```tsx
<ComposedForm
  schema={schema}
  onSubmit={handleFinalSubmit}
  onSubmitStep={(stepName, values) => {
    console.log(`Step "${stepName}" completed with`, values);
  }}
>
```

## API

### `<ComposedForm>`

The root component. Wraps your steps in a React Hook Form `FormProvider`.

| Prop | Type | Description |
|---|---|---|
| `schema` | `ZodSchema` | Zod schema for the entire form. Auto-wires `zodResolver`. |
| `resolver` | `Resolver` | Raw RHF resolver. Ignored if `schema` is provided. |
| `defaultValues` | `Partial<TValues>` | Default values for the entire form. |
| `onSubmit` | `SubmitHandler<TValues>` | Called after the final step validates successfully. |
| `onSubmitStep` | `(stepName: string, values: Partial<TValues>) => void \| Promise<void>` | Called after each step's fields validate successfully. |
| `children` | `ReactNode` | `<Step>` components and any other elements (nav bars, indicators). |

### `<Step>`

Defines a single step in the wizard.

| Prop | Type | Default | Description |
|---|---|---|---|
| `name` | `string` | -- | Unique identifier for this step. |
| `enabled` | `boolean` | `true` | When `false`, the step is skipped. Ignored when `enabledWhen` is provided. |
| `enabledWhen` | `(values: FieldValues) => boolean` | -- | Reactive predicate controlling step visibility. Re-evaluated on every form value change. |

### `useComposedFormContext()`

Returns everything from React Hook Form's `useFormContext()` plus wizard-specific actions. The `register` function is enhanced to automatically track fields in the enclosing `<Step>`.

**Navigation:**

| Property | Type | Description |
|---|---|---|
| `next` | `() => Promise<boolean>` | Validate current step, then advance or submit. |
| `back` | `() => void` | Go back (no validation). |
| `goTo` | `(name: string) => void` | Jump to a step by name. |

**State:**

| Property | Type | Description |
|---|---|---|
| `isFirstStep` | `boolean` | Whether the current step is first among enabled steps. |
| `isLastStep` | `boolean` | Whether the current step is last among enabled steps. |
| `currentStepName` | `string` | Name of the active step. |
| `currentStepIndex` | `number` | 0-based index in the full step list. |
| `stepCount` | `number` | Count of enabled steps. |
| `stepPosition` | `number` | 1-based position among enabled steps. |
| `steps` | `StepRegistration[]` | All registered steps (including disabled). |

### Re-exported from React Hook Form

For convenience, these are re-exported so you don't need a separate `react-hook-form` import:

`Controller`, `useController`, `useFieldArray`, `useFormState`, `useWatch`

## Examples

See the [`examples/`](./examples) directory:

- **[basic](./examples/basic)** -- signup wizard with conditional billing step, cross-field password validation, and a review screen
- **[advanced](./examples/advanced)** -- event planning wizard with multiple conditional steps, date validation, and dynamic field arrays

Run an example:

```bash
bun run --cwd examples/basic dev
```
