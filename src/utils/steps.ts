import type { StepRegistration } from '../types.ts';

/** Returns the index of the next enabled step after `currentIndex`, or -1. */
export function getNextEnabledIndex(
    steps: StepRegistration[],
    currentIndex: number
): number {
    for (let i = currentIndex + 1; i < steps.length; i++) {
        if (steps[i]!.isEnabled) return i;
    }
    return -1;
}

/** Returns the index of the previous enabled step before `currentIndex`, or -1. */
export function getPrevEnabledIndex(
    steps: StepRegistration[],
    currentIndex: number
): number {
    for (let i = currentIndex - 1; i >= 0; i--) {
        if (steps[i]!.isEnabled) return i;
    }
    return -1;
}

/** Returns the index of the first enabled step, or -1 if none exist. */
export function getFirstEnabledIndex(steps: StepRegistration[]): number {
    return steps.findIndex((s) => s.isEnabled);
}

/** Returns the index of the last enabled step, or -1 if none exist. */
export function getLastEnabledIndex(steps: StepRegistration[]): number {
    for (let i = steps.length - 1; i >= 0; i--) {
        if (steps[i]!.isEnabled) return i;
    }
    return -1;
}

/** Returns the step index by name, or -1 if not found. */
export function findStepIndexByName(
    steps: StepRegistration[],
    name: string
): number {
    return steps.findIndex((s) => s.name === name);
}

/**
 * Reads a value from a nested object using a dot-separated path.
 * Returns `undefined` if any segment along the path is missing or not an object.
 */
export function getNestedValue(
    obj: Record<string, unknown>,
    path: string
): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
        if (current === null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

/**
 * Builds a nested partial object from a flat source object using dot-separated
 * field paths. Each path is walked to retrieve its value from `source`, and the
 * result mirrors the nested structure that react-hook-form uses internally.
 *
 * Example:
 *   source  = { address: { city: 'SF' }, name: 'Alice' }
 *   paths   = ['address.city', 'name']
 *   result  = { address: { city: 'SF' }, name: 'Alice' }
 */
export function buildNestedPartial(
    source: Record<string, unknown>,
    paths: string[]
): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const path of paths) {
        const parts = path.split('.');
        const value = getNestedValue(source, path);
        let current = result;
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i]!;
            if (typeof current[part] !== 'object' || current[part] === null) {
                current[part] = {};
            }
            current = current[part] as Record<string, unknown>;
        }
        current[parts[parts.length - 1]!] = value;
    }
    return result;
}
