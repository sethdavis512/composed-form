import React from 'react';
import { afterEach, describe, expect, test } from 'bun:test';
import { render, screen, fireEvent, act, waitFor, cleanup } from '@testing-library/react';
import { z } from 'zod';
import {
    ComposedForm,
    Step,
    useComposedFormContext,
} from '../index.ts';

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function NavBar() {
    const { back, next, isFirstStep, isLastStep } =
        useComposedFormContext();
    return (
        <div>
            <button onClick={back} disabled={isFirstStep}>
                Back
            </button>
            <button onClick={() => void next()}>
                {isLastStep ? 'Submit' : 'Next'}
            </button>
        </div>
    );
}

function StepInfo() {
    const { currentStepName, stepCount, stepPosition, isFirstStep, isLastStep } =
        useComposedFormContext();
    return (
        <div data-testid="step-info">
            <span data-testid="step-name">{currentStepName}</span>
            <span data-testid="step-position">{stepPosition}</span>
            <span data-testid="step-count">{stepCount}</span>
            <span data-testid="is-first">{String(isFirstStep)}</span>
            <span data-testid="is-last">{String(isLastStep)}</span>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Basic rendering and navigation
// ---------------------------------------------------------------------------

describe('ComposedForm', () => {
    const schema = z.object({
        name: z.string().min(1, 'Name is required'),
        email: z.string().email('Invalid email')
    });

    function NameStep() {
        const { register, formState: { errors } } = useComposedFormContext();
        return (
            <div>
                <input {...register('name')} data-testid="name-input" />
                {errors.name && <p data-testid="name-error">{errors.name.message as string}</p>}
            </div>
        );
    }

    function EmailStep() {
        const { register, formState: { errors } } = useComposedFormContext();
        return (
            <div>
                <input {...register('email')} data-testid="email-input" />
                {errors.email && <p data-testid="email-error">{errors.email.message as string}</p>}
            </div>
        );
    }

    test('renders the first step by default', async () => {
        render(
            <ComposedForm schema={schema} onSubmit={() => {}}>
                <Step name="name"><NameStep /></Step>
                <Step name="email"><EmailStep /></Step>
                <NavBar />
            </ComposedForm>
        );

        await waitFor(() => {
            const nameStep = screen.getByTestId('name-input').closest('[data-step]');
            expect(nameStep).toBeTruthy();
            expect(nameStep!.getAttribute('style')).toBeNull();
        });

        const emailStep = screen.getByTestId('email-input').closest('[data-step]');
        expect(emailStep!.getAttribute('aria-hidden')).toBe('true');
    });

    test('validates current step before advancing', async () => {
        render(
            <ComposedForm schema={schema} onSubmit={() => {}}>
                <Step name="name"><NameStep /></Step>
                <Step name="email"><EmailStep /></Step>
                <NavBar />
            </ComposedForm>
        );

        await act(async () => {
            fireEvent.click(screen.getByText('Next'));
        });

        await waitFor(() => {
            expect(screen.getByTestId('name-error')).toBeTruthy();
        });

        // Should still be on step 1
        const nameStep = screen.getByTestId('name-input').closest('[data-step]');
        expect(nameStep!.getAttribute('aria-hidden')).toBeNull();
    });

    test('advances to next step after valid input', async () => {
        render(
            <ComposedForm schema={schema} onSubmit={() => {}}>
                <Step name="name"><NameStep /></Step>
                <Step name="email"><EmailStep /></Step>
                <NavBar />
            </ComposedForm>
        );

        await act(async () => {
            fireEvent.change(screen.getByTestId('name-input'), {
                target: { value: 'Alice' }
            });
        });

        await act(async () => {
            fireEvent.click(screen.getByText('Next'));
        });

        await waitFor(() => {
            const emailStep = screen.getByTestId('email-input').closest('[data-step]');
            expect(emailStep!.getAttribute('aria-hidden')).toBeNull();
        });
    });

    test('navigates back without validation', async () => {
        render(
            <ComposedForm schema={schema} onSubmit={() => {}}>
                <Step name="name"><NameStep /></Step>
                <Step name="email"><EmailStep /></Step>
                <NavBar />
            </ComposedForm>
        );

        // Fill and advance
        await act(async () => {
            fireEvent.change(screen.getByTestId('name-input'), {
                target: { value: 'Alice' }
            });
        });
        await act(async () => {
            fireEvent.click(screen.getByText('Next'));
        });

        await waitFor(() => {
            const emailStep = screen.getByTestId('email-input').closest('[data-step]');
            expect(emailStep!.getAttribute('aria-hidden')).toBeNull();
        });

        // Go back
        await act(async () => {
            fireEvent.click(screen.getByText('Back'));
        });

        await waitFor(() => {
            const nameStep = screen.getByTestId('name-input').closest('[data-step]');
            expect(nameStep!.getAttribute('aria-hidden')).toBeNull();
        });
    });

    test('calls onSubmit on the last step', async () => {
        let submitted: unknown = null;
        render(
            <ComposedForm
                schema={schema}
                onSubmit={(data) => { submitted = data; }}
            >
                <Step name="name"><NameStep /></Step>
                <Step name="email"><EmailStep /></Step>
                <NavBar />
            </ComposedForm>
        );

        // Fill step 1 and advance
        await act(async () => {
            fireEvent.change(screen.getByTestId('name-input'), {
                target: { value: 'Alice' }
            });
        });
        await act(async () => {
            fireEvent.click(screen.getByText('Next'));
        });

        // Fill step 2 and submit
        await waitFor(() => {
            expect(screen.getByText('Submit')).toBeTruthy();
        });

        await act(async () => {
            fireEvent.change(screen.getByTestId('email-input'), {
                target: { value: 'alice@example.com' }
            });
        });
        await act(async () => {
            fireEvent.click(screen.getByText('Submit'));
        });

        await waitFor(() => {
            expect(submitted).toEqual({ name: 'Alice', email: 'alice@example.com' });
        });
    });

    test('calls onSubmitStep after each step validates', async () => {
        const stepResults: Array<[string, unknown]> = [];
        render(
            <ComposedForm
                schema={schema}
                onSubmit={() => {}}
                onSubmitStep={(name, values) => { stepResults.push([name, values]); }}
            >
                <Step name="name"><NameStep /></Step>
                <Step name="email"><EmailStep /></Step>
                <NavBar />
            </ComposedForm>
        );

        await act(async () => {
            fireEvent.change(screen.getByTestId('name-input'), {
                target: { value: 'Bob' }
            });
        });
        await act(async () => {
            fireEvent.click(screen.getByText('Next'));
        });

        await waitFor(() => {
            expect(stepResults.length).toBe(1);
            expect(stepResults[0]![0]).toBe('name');
            expect(stepResults[0]![1]).toEqual({ name: 'Bob' });
        });
    });
});

// ---------------------------------------------------------------------------
// Conditional steps
// ---------------------------------------------------------------------------

describe('Conditional steps', () => {
    const schema = z.object({
        plan: z.enum(['free', 'pro']),
        card: z.string().optional()
    });

    function PlanStep() {
        const { register } = useComposedFormContext();
        return <select {...register('plan')} data-testid="plan-select">
            <option value="free">Free</option>
            <option value="pro">Pro</option>
        </select>;
    }

    function CardStep() {
        const { register } = useComposedFormContext();
        return <input {...register('card')} data-testid="card-input" />;
    }

    function ConditionalApp() {
        return (
            <ComposedForm
                schema={schema}
                defaultValues={{ plan: 'free' }}
                onSubmit={() => {}}
            >
                <StepInfo />
                <Step name="plan"><PlanStep /></Step>
                <Step name="card" enabledWhen={(v) => v.plan === 'pro'}><CardStep /></Step>
                <NavBar />
            </ComposedForm>
        );
    }

    test('disabled step is hidden and skipped in count', async () => {
        render(<ConditionalApp />);

        await waitFor(() => {
            expect(screen.getByTestId('step-count').textContent).toBe('1');
        });

        // Card step exists in DOM but is hidden
        const cardStep = screen.getByTestId('card-input').closest('[data-step]');
        expect(cardStep!.getAttribute('aria-hidden')).toBe('true');
    });

    test('enabling a step updates count and allows navigation', async () => {
        render(<ConditionalApp />);

        await act(async () => {
            fireEvent.change(screen.getByTestId('plan-select'), {
                target: { value: 'pro' }
            });
        });

        await waitFor(() => {
            expect(screen.getByTestId('step-count').textContent).toBe('2');
        });
    });
});

// ---------------------------------------------------------------------------
// Cross-step validation (.refine)
// ---------------------------------------------------------------------------

describe('Cross-step validation', () => {
    const schema = z
        .object({
            password: z.string().min(4, 'Too short'),
            confirm: z.string()
        })
        .refine((d) => d.password === d.confirm, {
            message: 'Must match',
            path: ['confirm']
        });

    function PasswordStep() {
        const { register, formState: { errors } } = useComposedFormContext();
        return (
            <div>
                <input {...register('password')} data-testid="pw-input" />
                {errors.password && <p data-testid="pw-error">{errors.password.message as string}</p>}
            </div>
        );
    }

    function ConfirmStep() {
        const { register, formState: { errors } } = useComposedFormContext();
        return (
            <div>
                <input {...register('confirm')} data-testid="confirm-input" />
                {errors.confirm && <p data-testid="confirm-error">{errors.confirm.message as string}</p>}
            </div>
        );
    }

    test('refine error lands on the correct step', async () => {
        let submitted = false;
        render(
            <ComposedForm
                schema={schema}
                onSubmit={() => { submitted = true; }}
            >
                <Step name="password"><PasswordStep /></Step>
                <Step name="confirm"><ConfirmStep /></Step>
                <NavBar />
            </ComposedForm>
        );

        // Fill password and advance
        await act(async () => {
            fireEvent.change(screen.getByTestId('pw-input'), {
                target: { value: 'abcd' }
            });
        });
        await act(async () => {
            fireEvent.click(screen.getByText('Next'));
        });

        // On confirm step -- enter mismatching value
        await waitFor(() => {
            expect(screen.getByText('Submit')).toBeTruthy();
        });

        await act(async () => {
            fireEvent.change(screen.getByTestId('confirm-input'), {
                target: { value: 'wrong' }
            });
        });
        await act(async () => {
            fireEvent.click(screen.getByText('Submit'));
        });

        await waitFor(() => {
            expect(screen.getByTestId('confirm-error').textContent).toBe('Must match');
        });
        expect(submitted).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Step metadata (stepCount, stepPosition)
// ---------------------------------------------------------------------------

describe('step metadata', () => {
    const schema = z.object({
        a: z.string().optional(),
        b: z.string().optional(),
        c: z.string().optional()
    });

    function StepA() {
        const { register } = useComposedFormContext();
        return <input {...register('a')} data-testid="a-input" />;
    }
    function StepB() {
        const { register } = useComposedFormContext();
        return <input {...register('b')} data-testid="b-input" />;
    }
    function StepC() {
        const { register } = useComposedFormContext();
        return <input {...register('c')} data-testid="c-input" />;
    }

    test('reports correct position and count', async () => {
        render(
            <ComposedForm schema={schema} onSubmit={() => {}}>
                <StepInfo />
                <Step name="a"><StepA /></Step>
                <Step name="b"><StepB /></Step>
                <Step name="c"><StepC /></Step>
                <NavBar />
            </ComposedForm>
        );

        await waitFor(() => {
            expect(screen.getByTestId('step-name').textContent).toBe('a');
            expect(screen.getByTestId('step-position').textContent).toBe('1');
            expect(screen.getByTestId('step-count').textContent).toBe('3');
            expect(screen.getByTestId('is-first').textContent).toBe('true');
            expect(screen.getByTestId('is-last').textContent).toBe('false');
        });

        // Advance to step 2
        await act(async () => {
            fireEvent.click(screen.getByText('Next'));
        });

        await waitFor(() => {
            expect(screen.getByTestId('step-name').textContent).toBe('b');
            expect(screen.getByTestId('step-position').textContent).toBe('2');
            expect(screen.getByTestId('is-first').textContent).toBe('false');
            expect(screen.getByTestId('is-last').textContent).toBe('false');
        });
    });

});

// ---------------------------------------------------------------------------
// useComposedFormContext
// ---------------------------------------------------------------------------

describe('useComposedFormContext', () => {
    test('throws when used outside ComposedForm', () => {
        function BadComponent() {
            useComposedFormContext();
            return null;
        }
        expect(() => render(<BadComponent />)).toThrow(
            /useComposedFormContext must be used inside/
        );
    });
});

// ---------------------------------------------------------------------------
// goTo (direct navigation)
// ---------------------------------------------------------------------------

describe('goTo', () => {
    const schema = z.object({
        a: z.string().optional(),
        b: z.string().optional(),
        c: z.string().optional()
    });

    function StepA() {
        const { register } = useComposedFormContext();
        return <input {...register('a')} />;
    }
    function StepB() {
        const { register } = useComposedFormContext();
        return <input {...register('b')} />;
    }
    function StepC() {
        const { register } = useComposedFormContext();
        return <input {...register('c')} />;
    }

    function JumpNav() {
        const { goTo } = useComposedFormContext();
        return (
            <div>
                <button onClick={() => goTo('c')}>Jump to C</button>
            </div>
        );
    }

    test('jumps to a step by name without validation', async () => {
        render(
            <ComposedForm schema={schema} onSubmit={() => {}}>
                <StepInfo />
                <Step name="a"><StepA /></Step>
                <Step name="b"><StepB /></Step>
                <Step name="c"><StepC /></Step>
                <JumpNav />
            </ComposedForm>
        );

        await waitFor(() => {
            expect(screen.getByTestId('step-name').textContent).toBe('a');
        });

        await act(async () => {
            fireEvent.click(screen.getByText('Jump to C'));
        });

        await waitFor(() => {
            expect(screen.getByTestId('step-name').textContent).toBe('c');
        });
    });
});

// ---------------------------------------------------------------------------
// Step component
// ---------------------------------------------------------------------------

describe('Step', () => {
    test('throws when rendered outside ComposedForm', () => {
        expect(() => {
            render(<Step name="orphan"><div>Orphan</div></Step>);
        }).toThrow(/must be rendered inside/);
    });
});

// ---------------------------------------------------------------------------
// defaultValues
// ---------------------------------------------------------------------------

describe('defaultValues', () => {
    const schema = z.object({
        greeting: z.string().min(1)
    });

    function GreetingStep() {
        const { register } = useComposedFormContext();
        return <input {...register('greeting')} data-testid="greeting-input" />;
    }

    test('populates fields with default values', async () => {
        render(
            <ComposedForm
                schema={schema}
                defaultValues={{ greeting: 'Hello' }}
                onSubmit={() => {}}
            >
                <Step name="greet"><GreetingStep /></Step>
            </ComposedForm>
        );

        await waitFor(() => {
            const input = screen.getByTestId('greeting-input') as HTMLInputElement;
            expect(input.value).toBe('Hello');
        });
    });
});

// ---------------------------------------------------------------------------
// Custom resolver (no schema)
// ---------------------------------------------------------------------------

describe('custom resolver', () => {
    test('works without a zod schema when resolver is provided', async () => {
        let submitted: unknown = null;

        // Simple custom resolver that always passes
        const customResolver = () => ({ values: { name: 'resolved' }, errors: {} });

        function NameStep() {
            const { register } = useComposedFormContext();
            return <input {...register('name')} data-testid="name-input" />;
        }

        render(
            <ComposedForm
                resolver={customResolver as any}
                onSubmit={(data) => { submitted = data; }}
            >
                <Step name="name"><NameStep /></Step>
                <NavBar />
            </ComposedForm>
        );

        await act(async () => {
            fireEvent.click(screen.getByText('Submit'));
        });

        await waitFor(() => {
            expect(submitted).toEqual({ name: 'resolved' });
        });
    });
});
