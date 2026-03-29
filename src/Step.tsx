import React, { useContext, useEffect, useMemo, useRef } from 'react';
import { useWatch } from 'react-hook-form';
import { ComposedFormContext } from './context/ComposedFormContext.ts';
import { StepContext } from './context/StepContext.ts';
import type { StepContextValue, StepProps } from './types.ts';

export function Step({ name, enabled = true, enabledWhen, children }: StepProps) {
    const wizard = useContext(ComposedFormContext);

    if (!wizard) {
        throw new Error('<Step> must be rendered inside <ComposedForm>.');
    }

    const {
        _registerStep,
        _unregisterStep,
        _updateStepEnabled,
        currentStepName
    } = wizard;

    // When enabledWhen is provided, watch all form values to re-evaluate
    // the predicate reactively. useWatch() must be called unconditionally
    // (rules of hooks), but the result is only used when enabledWhen exists.
    const values = useWatch();
    const effectiveEnabled = enabledWhen
        ? Boolean(enabledWhen(values))
        : enabled;

    // Stable ref that accumulates field names as fields call register().
    const fieldRegistry = useRef<Set<string>>(new Set());

    // Register on mount, unregister on unmount.
    useEffect(() => {
        _registerStep({ name, isEnabled: effectiveEnabled, fieldRegistry });
        return () => {
            _unregisterStep(name);
        };
        // name is treated as stable (don't change step names at runtime)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name]);

    // Sync enabled changes without a full remount.
    useEffect(() => {
        _updateStepEnabled(name, effectiveEnabled);
    }, [name, effectiveEnabled, _updateStepEnabled]);

    const isActive = currentStepName === name;

    const stepContextValue = useMemo<StepContextValue>(
        () => ({ name, isActive, fieldRegistry }),
        [name, isActive]
    );

    // Always render children so their hooks stay mounted (preserves RHF field
    // state). We just hide non-active steps visually.
    return (
        <StepContext.Provider value={stepContextValue}>
            <div
                data-step={name}
                style={isActive ? undefined : { display: 'none' }}
                aria-hidden={isActive ? undefined : true}
            >
                {children}
            </div>
        </StepContext.Provider>
    );
}
