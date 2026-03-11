import React, { useContext, useEffect, useMemo, useRef } from 'react';
import { ComposedFormContext } from './context/ComposedFormContext.ts';
import { StepContext } from './context/StepContext.ts';
import type { StepContextValue, StepProps } from './types.ts';

export function Step({ name, enabled = true, children }: StepProps) {
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

    // Stable ref that accumulates field names as fields call register().
    const fieldRegistry = useRef<Set<string>>(new Set());

    // Register on mount, unregister on unmount.
    useEffect(() => {
        _registerStep({ name, isEnabled: enabled, fieldRegistry });
        return () => {
            _unregisterStep(name);
        };
        // name is treated as stable (don't change step names at runtime)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name]);

    // Sync enabled changes without a full remount.
    useEffect(() => {
        _updateStepEnabled(name, enabled);
    }, [name, enabled, _updateStepEnabled]);

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
