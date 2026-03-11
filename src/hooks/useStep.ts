import { useContext } from 'react';
import { ComposedFormContext } from '../context/ComposedFormContext.ts';
import type { StepRegistration } from '../types.ts';

export interface UseStepReturn {
    /** Name of the currently active step. */
    currentStepName: string;
    /** Whether the current step is the very first enabled step. */
    isFirstStep: boolean;
    /** Whether the current step is the very last enabled step. */
    isLastStep: boolean;
    /** All registered (and enabled) steps in order. */
    steps: StepRegistration[];
    /** 0-based index of the current step. */
    currentStepIndex: number;
    /** Count of enabled steps. */
    stepCount: number;
    /** 1-based position of the current step within enabled steps only. */
    stepPosition: number;
}

/**
 * Returns information about the current step in the nearest `<ComposedForm>`.
 * Useful for rendering progress indicators, back/next buttons, etc.
 */
export function useStep(): UseStepReturn {
    const wizard = useContext(ComposedFormContext);

    if (!wizard) {
        throw new Error('useStep must be used inside a <ComposedForm>.');
    }

    const {
        steps,
        currentStepIndex,
        currentStepName,
        isFirstStep,
        isLastStep
    } = wizard;

    const enabledSteps = steps.filter((s) => s.isEnabled);
    const stepCount = enabledSteps.length;

    // stepPosition: 1-based rank of currentStepIndex among enabled steps
    const stepPosition =
        enabledSteps.findIndex(
            (s) => s.name === steps[currentStepIndex]?.name
        ) + 1;

    return {
        currentStepName,
        isFirstStep,
        isLastStep,
        steps,
        currentStepIndex,
        stepCount,
        stepPosition
    };
}
