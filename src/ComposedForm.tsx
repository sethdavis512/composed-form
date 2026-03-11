import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type { FieldValues } from 'react-hook-form';
import type { ZodSchema, z } from 'zod';
import { ComposedFormContext } from './context/ComposedFormContext.ts';
import { createZodResolver } from './utils/resolver.ts';
import {
    buildNestedPartial,
    findStepIndexByName,
    getFirstEnabledIndex,
    getLastEnabledIndex,
    getNextEnabledIndex,
    getPrevEnabledIndex
} from './utils/steps.ts';
import type {
    ComposedFormContextValue,
    ComposedFormProps,
    StepRegistration
} from './types.ts';

export function ComposedForm<
    TSchema extends ZodSchema = ZodSchema,
    TValues extends FieldValues = z.infer<TSchema>
>({
    schema,
    resolver,
    defaultValues,
    onSubmit,
    onSubmitStep,
    children
}: ComposedFormProps<TSchema, TValues>) {
    const form = useForm<TValues>({
        shouldUnregister: false,
        resolver: schema
            ? (createZodResolver(schema as ZodSchema<TValues>) as never)
            : resolver,
        defaultValues: defaultValues as never
    });

    // `steps` is an ordered array that mirrors the render order of <Step> children.
    // We use a ref for the raw mutable list and a state counter to trigger re-renders
    // when registrations change — this avoids stale closures while keeping React
    // tree updates minimal.
    const stepsRef = useRef<StepRegistration[]>([]);
    const [, forceUpdate] = useState(0);
    const bump = useCallback(() => forceUpdate((n) => n + 1), []);

    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    // -------------------------------------------------------------------------
    // Step registration
    // -------------------------------------------------------------------------

    const _registerStep = useCallback(
        (reg: StepRegistration) => {
            const existing = stepsRef.current.findIndex(
                (s) => s.name === reg.name
            );
            if (existing === -1) {
                stepsRef.current = [...stepsRef.current, reg];
            } else {
                if (process.env.NODE_ENV !== 'production') {
                    console.warn(
                        `[composed-form] Duplicate <Step name="${reg.name}"> detected. Step names must be unique.`
                    );
                }
                stepsRef.current = stepsRef.current.map((s, i) =>
                    i === existing ? reg : s
                );
            }
            bump();
        },
        [bump]
    );

    const _unregisterStep = useCallback(
        (name: string) => {
            const removedIdx = stepsRef.current.findIndex(
                (s) => s.name === name
            );
            stepsRef.current = stepsRef.current.filter((s) => s.name !== name);
            if (removedIdx !== -1) {
                setCurrentStepIndex((prev) => {
                    if (removedIdx < prev) return prev - 1;
                    if (removedIdx === prev) {
                        // Snap to first enabled step in the post-removal list.
                        const first = getFirstEnabledIndex(stepsRef.current);
                        return first !== -1 ? first : 0;
                    }
                    return prev;
                });
            }
            bump();
        },
        [bump]
    );

    const _updateStepEnabled = useCallback(
        (name: string, enabled: boolean) => {
            stepsRef.current = stepsRef.current.map((s) =>
                s.name === name ? { ...s, isEnabled: enabled } : s
            );
            bump();
        },
        [bump]
    );

    // -------------------------------------------------------------------------
    // Navigation
    // -------------------------------------------------------------------------

    const steps = stepsRef.current;

    const goToNextStep = useCallback(async (): Promise<boolean> => {
        const current = steps[currentStepIndex];
        if (!current) return false;

        const fieldNames = Array.from(current.fieldRegistry.current);
        const valid =
            fieldNames.length > 0
                ? await form.trigger(fieldNames as never[])
                : true;

        if (!valid) return false;

        if (onSubmitStep) {
            const allValues = form.getValues();
            const stepValues = buildNestedPartial(
                allValues as Record<string, unknown>,
                fieldNames
            ) as Partial<TValues>;
            await onSubmitStep(current.name, stepValues);
        }

        const nextIndex = getNextEnabledIndex(steps, currentStepIndex);
        if (nextIndex === -1) return false;

        setCurrentStepIndex(nextIndex);
        return true;
    }, [steps, currentStepIndex, form, onSubmitStep]);

    const goToPreviousStep = useCallback(() => {
        const prevIndex = getPrevEnabledIndex(steps, currentStepIndex);
        if (prevIndex !== -1) setCurrentStepIndex(prevIndex);
    }, [steps, currentStepIndex]);

    const goToStep = useCallback(
        (name: string) => {
            const idx = findStepIndexByName(steps, name);
            if (idx !== -1 && steps[idx]!.isEnabled) setCurrentStepIndex(idx);
        },
        [steps]
    );

    const submitStep = useCallback(async (): Promise<boolean> => {
        const lastEnabledIndex = getLastEnabledIndex(steps);
        const isLast = currentStepIndex === lastEnabledIndex;

        const current = steps[currentStepIndex];
        if (!current) return false;

        const fieldNames = Array.from(current.fieldRegistry.current);
        const valid =
            fieldNames.length > 0
                ? await form.trigger(fieldNames as never[])
                : true;

        if (!valid) return false;

        if (onSubmitStep) {
            const allValues = form.getValues();
            const stepValues = buildNestedPartial(
                allValues as Record<string, unknown>,
                fieldNames
            ) as Partial<TValues>;
            await onSubmitStep(current.name, stepValues);
        }

        if (isLast) {
            let succeeded = false;
            await form.handleSubmit(async (values) => {
                await onSubmit(values);
                succeeded = true;
            })();
            return succeeded;
        }

        const nextIndex = getNextEnabledIndex(steps, currentStepIndex);
        if (nextIndex !== -1) setCurrentStepIndex(nextIndex);
        return true;
    }, [steps, currentStepIndex, form, onSubmit, onSubmitStep]);

    // If the active step is disabled or out-of-bounds (e.g., first step starts
    // disabled, or the current step is dynamically toggled off), snap to the
    // first enabled step.
    useEffect(() => {
        if (!steps[currentStepIndex]?.isEnabled) {
            const first = getFirstEnabledIndex(steps);
            if (first !== -1) setCurrentStepIndex(first);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [steps, currentStepIndex]);

    // -------------------------------------------------------------------------
    // Derived state
    // -------------------------------------------------------------------------

    const firstEnabledIndex = getFirstEnabledIndex(steps);
    const lastEnabledIndex = getLastEnabledIndex(steps);
    const isFirstStep = currentStepIndex === firstEnabledIndex;
    const isLastStep = currentStepIndex === lastEnabledIndex;
    const currentStepName = steps[currentStepIndex]?.name ?? '';

    // -------------------------------------------------------------------------
    // Context value
    // -------------------------------------------------------------------------

    const contextValue = useMemo<ComposedFormContextValue<TValues>>(
        () => ({
            steps,
            currentStepIndex,
            goToNextStep,
            goToPreviousStep,
            goToStep,
            submitStep,
            isFirstStep,
            isLastStep,
            currentStepName,
            _registerStep,
            _unregisterStep,
            _updateStepEnabled,
            form: form as unknown as ComposedFormContextValue<TValues>['form']
        }),
        [
            steps,
            currentStepIndex,
            goToNextStep,
            goToPreviousStep,
            goToStep,
            submitStep,
            isFirstStep,
            isLastStep,
            currentStepName,
            _registerStep,
            _unregisterStep,
            _updateStepEnabled,
            form
        ]
    );

    return (
        <ComposedFormContext.Provider
            value={contextValue as ComposedFormContextValue<FieldValues>}
        >
            <FormProvider {...form}>{children}</FormProvider>
        </ComposedFormContext.Provider>
    );
}
