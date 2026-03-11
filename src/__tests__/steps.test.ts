import { describe, expect, test } from 'bun:test';
import {
    buildNestedPartial,
    findStepIndexByName,
    getFirstEnabledIndex,
    getLastEnabledIndex,
    getNestedValue,
    getNextEnabledIndex,
    getPrevEnabledIndex
} from '../utils/steps.ts';
import type { StepRegistration } from '../types.ts';
import { createRef } from 'react';

function makeSteps(
    defs: Array<{ name: string; enabled: boolean }>
): StepRegistration[] {
    return defs.map(({ name, enabled }) => ({
        name,
        isEnabled: enabled,
        fieldRegistry: createRef() as React.MutableRefObject<Set<string>>
    }));
}

describe('getNextEnabledIndex', () => {
    test('returns the next enabled step', () => {
        const steps = makeSteps([
            { name: 'a', enabled: true },
            { name: 'b', enabled: true },
            { name: 'c', enabled: true }
        ]);
        expect(getNextEnabledIndex(steps, 0)).toBe(1);
        expect(getNextEnabledIndex(steps, 1)).toBe(2);
    });

    test('skips disabled steps', () => {
        const steps = makeSteps([
            { name: 'a', enabled: true },
            { name: 'b', enabled: false },
            { name: 'c', enabled: true }
        ]);
        expect(getNextEnabledIndex(steps, 0)).toBe(2);
    });

    test('returns -1 when there is no next enabled step', () => {
        const steps = makeSteps([
            { name: 'a', enabled: true },
            { name: 'b', enabled: false }
        ]);
        expect(getNextEnabledIndex(steps, 0)).toBe(-1);
    });
});

describe('getPrevEnabledIndex', () => {
    test('returns the previous enabled step', () => {
        const steps = makeSteps([
            { name: 'a', enabled: true },
            { name: 'b', enabled: true },
            { name: 'c', enabled: true }
        ]);
        expect(getPrevEnabledIndex(steps, 2)).toBe(1);
        expect(getPrevEnabledIndex(steps, 1)).toBe(0);
    });

    test('skips disabled steps', () => {
        const steps = makeSteps([
            { name: 'a', enabled: true },
            { name: 'b', enabled: false },
            { name: 'c', enabled: true }
        ]);
        expect(getPrevEnabledIndex(steps, 2)).toBe(0);
    });

    test('returns -1 when there is no previous enabled step', () => {
        const steps = makeSteps([
            { name: 'a', enabled: false },
            { name: 'b', enabled: true }
        ]);
        expect(getPrevEnabledIndex(steps, 1)).toBe(-1);
    });
});

describe('getFirstEnabledIndex', () => {
    test('returns index of first enabled step', () => {
        const steps = makeSteps([
            { name: 'a', enabled: false },
            { name: 'b', enabled: true },
            { name: 'c', enabled: true }
        ]);
        expect(getFirstEnabledIndex(steps)).toBe(1);
    });

    test('returns -1 when all steps are disabled', () => {
        const steps = makeSteps([
            { name: 'a', enabled: false },
            { name: 'b', enabled: false }
        ]);
        expect(getFirstEnabledIndex(steps)).toBe(-1);
    });
});

describe('getLastEnabledIndex', () => {
    test('returns index of last enabled step', () => {
        const steps = makeSteps([
            { name: 'a', enabled: true },
            { name: 'b', enabled: true },
            { name: 'c', enabled: false }
        ]);
        expect(getLastEnabledIndex(steps)).toBe(1);
    });

    test('returns -1 when all steps are disabled', () => {
        const steps = makeSteps([{ name: 'a', enabled: false }]);
        expect(getLastEnabledIndex(steps)).toBe(-1);
    });
});

describe('findStepIndexByName', () => {
    test('finds step by name', () => {
        const steps = makeSteps([
            { name: 'personal', enabled: true },
            { name: 'billing', enabled: true }
        ]);
        expect(findStepIndexByName(steps, 'billing')).toBe(1);
    });

    test('returns -1 for unknown name', () => {
        const steps = makeSteps([{ name: 'a', enabled: true }]);
        expect(findStepIndexByName(steps, 'z')).toBe(-1);
    });
});

// ---------------------------------------------------------------------------
// Edge cases: empty arrays and out-of-bounds indices
// ---------------------------------------------------------------------------

describe('getNextEnabledIndex – edge cases', () => {
    test('returns -1 for empty array', () => {
        expect(getNextEnabledIndex([], 0)).toBe(-1);
    });

    test('returns -1 when currentIndex is past the end', () => {
        const steps = makeSteps([{ name: 'a', enabled: true }]);
        expect(getNextEnabledIndex(steps, 5)).toBe(-1);
    });

    test('returns -1 when all remaining steps are disabled', () => {
        const steps = makeSteps([
            { name: 'a', enabled: true },
            { name: 'b', enabled: false },
            { name: 'c', enabled: false }
        ]);
        expect(getNextEnabledIndex(steps, 0)).toBe(-1);
    });
});

describe('getPrevEnabledIndex – edge cases', () => {
    test('returns -1 for empty array', () => {
        expect(getPrevEnabledIndex([], 0)).toBe(-1);
    });

    test('returns -1 when currentIndex is 0', () => {
        const steps = makeSteps([{ name: 'a', enabled: true }]);
        expect(getPrevEnabledIndex(steps, 0)).toBe(-1);
    });
});

describe('getFirstEnabledIndex – edge cases', () => {
    test('returns -1 for empty array', () => {
        expect(getFirstEnabledIndex([])).toBe(-1);
    });
});

describe('getLastEnabledIndex – edge cases', () => {
    test('returns -1 for empty array', () => {
        expect(getLastEnabledIndex([])).toBe(-1);
    });
});

// ---------------------------------------------------------------------------
// getNestedValue
// ---------------------------------------------------------------------------

describe('getNestedValue', () => {
    test('returns a top-level value', () => {
        expect(getNestedValue({ a: 1 }, 'a')).toBe(1);
    });

    test('returns a nested value via dot path', () => {
        expect(getNestedValue({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
    });

    test('returns undefined for a missing top-level key', () => {
        expect(getNestedValue({ a: 1 }, 'b')).toBeUndefined();
    });

    test('returns undefined when an intermediate node is not an object', () => {
        expect(getNestedValue({ a: 'string' }, 'a.b')).toBeUndefined();
    });

    test('returns undefined when an intermediate node is null', () => {
        expect(
            getNestedValue({ a: null } as Record<string, unknown>, 'a.b')
        ).toBeUndefined();
    });

    test('returns undefined for a deeply missing path', () => {
        expect(getNestedValue({ a: { x: 1 } }, 'a.b.c')).toBeUndefined();
    });

    test('handles a falsy (0) value without treating it as missing', () => {
        expect(getNestedValue({ count: 0 }, 'count')).toBe(0);
    });

    test('handles a nested falsy (false) value', () => {
        expect(
            getNestedValue({ flags: { active: false } }, 'flags.active')
        ).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// buildNestedPartial
// ---------------------------------------------------------------------------

describe('buildNestedPartial', () => {
    test('builds a flat partial from top-level paths', () => {
        const source = { a: 1, b: 2, c: 3 };
        expect(buildNestedPartial(source, ['a', 'b'])).toEqual({ a: 1, b: 2 });
    });

    test('builds a nested partial from dot-path keys', () => {
        const source = {
            address: { city: 'SF', zip: '94102' },
            name: 'Alice'
        } as Record<string, unknown>;
        expect(buildNestedPartial(source, ['address.city', 'name'])).toEqual({
            address: { city: 'SF' },
            name: 'Alice'
        });
    });

    test('handles deeply nested paths', () => {
        const source = { a: { b: { c: 99 } } } as Record<string, unknown>;
        expect(buildNestedPartial(source, ['a.b.c'])).toEqual({
            a: { b: { c: 99 } }
        });
    });

    test('returns empty object for empty paths array', () => {
        expect(buildNestedPartial({ a: 1 }, [])).toEqual({});
    });

    test('sets undefined for a path missing in the source', () => {
        expect(buildNestedPartial({ a: 1 }, ['b.c'])).toEqual({
            b: { c: undefined }
        });
    });

    test('merges sibling paths under the same parent', () => {
        const source = {
            address: { city: 'SF', zip: '94102', country: 'US' }
        } as Record<string, unknown>;
        expect(
            buildNestedPartial(source, ['address.city', 'address.zip'])
        ).toEqual({
            address: { city: 'SF', zip: '94102' }
        });
    });

    test('does not clobber an existing nested node when adding a sibling', () => {
        const source = { meta: { a: 1, b: 2 } } as Record<string, unknown>;
        const result = buildNestedPartial(source, ['meta.a', 'meta.b']);
        expect(result).toEqual({ meta: { a: 1, b: 2 } });
    });
});
