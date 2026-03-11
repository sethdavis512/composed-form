import type { MutableRefObject } from 'react';
import type {
    FieldValues,
    Resolver,
    SubmitHandler,
    UseFormReturn
} from 'react-hook-form';
import type { ZodSchema, z } from 'zod';

// ---------------------------------------------------------------------------
// Step registration (internal)
// ---------------------------------------------------------------------------

export interface StepRegistration {
    name: string;
    isEnabled: boolean;
    fieldRegistry: MutableRefObject<Set<string>>;
}

// ---------------------------------------------------------------------------
// ComposedForm
// ---------------------------------------------------------------------------

export interface ComposedFormProps<
    TSchema extends ZodSchema = ZodSchema,
    TValues extends FieldValues = z.infer<TSchema>
> {
    /** Zod schema for the entire form. Auto-wires `zodResolver`. */
    schema?: TSchema;
    /**
     * Raw RHF resolver. Used instead of `schema` when you need a custom resolver
     * (e.g. a hand-rolled async one). Ignored if `schema` is provided.
     */
    resolver?: Resolver<TValues>;
    /** Default values for the entire form. */
    defaultValues?: Partial<NoInfer<TValues>>;
    /** Called after the final step validates successfully. */
    onSubmit: SubmitHandler<TValues>;
    /**
     * Called after each step's fields validate successfully (before advancing).
     * Receives the partial values for the fields registered in that step.
     */
    onSubmitStep?: (
        stepName: string,
        values: Partial<TValues>
    ) => void | Promise<void>;
    children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

export interface StepProps {
    /** Unique identifier for this step (used in navigation and `useStep`). */
    name: string;
    /**
     * When `false` this step is skipped entirely during navigation and its fields
     * are omitted from step validation. Defaults to `true`.
     */
    enabled?: boolean;
    children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

export interface ComposedFormContextValue<
    TValues extends FieldValues = FieldValues
> {
    /** All currently registered step definitions, including disabled ones. */
    steps: StepRegistration[];
    /** Index of the currently active step within `steps`. */
    currentStepIndex: number;
    /** Navigate to the next enabled step, validating the current step first. */
    goToNextStep: () => Promise<boolean>;
    /** Navigate to the previous enabled step (no validation). */
    goToPreviousStep: () => void;
    /** Navigate to a specific step by name (no validation). */
    goToStep: (name: string) => void;
    /**
     * Trigger validation for the current step's fields and — if valid — call
     * `onSubmit` if this is the last step, or advance otherwise.
     */
    submitStep: () => Promise<boolean>;
    /** Whether the current step is the first enabled step. */
    isFirstStep: boolean;
    /** Whether the current step is the last enabled step. */
    isLastStep: boolean;
    /** The name of the currently active step. */
    currentStepName: string;
    /**
     * Internal: called by `<Step>` on mount to register itself with the wizard.
     * @internal
     */
    _registerStep: (reg: StepRegistration) => void;
    /**
     * Internal: called by `<Step>` on unmount or when `enabled` changes.
     * @internal
     */
    _unregisterStep: (name: string) => void;
    /**
     * Internal: called by `<Step>` when its `enabled` prop changes.
     * @internal
     */
    _updateStepEnabled: (name: string, enabled: boolean) => void;
    /** The underlying RHF form instance (exposed for advanced use-cases). */
    form: UseFormReturn<TValues>;
}

export interface StepContextValue {
    /** Name of this step. */
    name: string;
    /** Whether this step is currently visible/active. */
    isActive: boolean;
    /**
     * All field names registered under this step via `useComposedFormContext().register`.
     * @internal
     */
    fieldRegistry: MutableRefObject<Set<string>>;
}
