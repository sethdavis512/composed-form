import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import {
    ComposedForm,
    Step,
    useComposedFormContext,
    useWatch
} from 'composed-form';

// ---------------------------------------------------------------------------
// Schema — the entire form in one Zod object.
// The cross-field refine validates password confirmation at the schema level;
// zodResolver runs the full schema on every trigger() call so per-step
// validation catches the mismatch correctly.
// ---------------------------------------------------------------------------

const schema = z
    .object({
        firstName: z.string().min(1, 'First name is required'),
        lastName: z.string().min(1, 'Last name is required'),
        username: z
            .string()
            .min(3, 'Username must be at least 3 characters')
            .regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers and _ only'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        confirmPassword: z.string(),
        plan: z.enum(['free', 'pro'], { message: 'Please choose a plan' }),
        // Only required for pro, kept optional so free plan isn't blocked.
        cardNumber: z.string().optional()
    })
    .refine((d) => d.password === d.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword']
    });

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Step indicator — shows all enabled steps with past/current highlights
// ---------------------------------------------------------------------------

const STEP_LABELS: Record<string, string> = {
    personal: 'Personal',
    account: 'Account',
    plan: 'Plan',
    billing: 'Billing',
    review: 'Review'
};

function StepIndicator() {
    const { steps, currentStepName } = useComposedFormContext<FormValues>();
    const enabledSteps = steps.filter((s) => s.isEnabled);
    const currentIdx = enabledSteps.findIndex(
        (s) => s.name === currentStepName
    );

    return (
        <div className="step-indicator">
            {enabledSteps.map((step, i) => (
                <div
                    key={step.name}
                    className={[
                        'step-dot',
                        i < currentIdx ? 'past' : '',
                        step.name === currentStepName ? 'current' : ''
                    ]
                        .filter(Boolean)
                        .join(' ')}
                >
                    <div className="dot" />
                    <span>{STEP_LABELS[step.name] ?? step.name}</span>
                </div>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Shared navigation bar
// ---------------------------------------------------------------------------

function NavBar() {
    const { back, next, isFirstStep, isLastStep } =
        useComposedFormContext<FormValues>();

    return (
        <div className="nav">
            <button
                type="button"
                className="secondary"
                onClick={back}
                disabled={isFirstStep}
            >
                ← Back
            </button>
            <button type="button" onClick={() => void next()}>
                {isLastStep ? 'Submit' : 'Next →'}
            </button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Step 1 — Personal info
// ---------------------------------------------------------------------------

function PersonalStep() {
    const {
        register,
        formState: { errors }
    } = useComposedFormContext<FormValues>();

    return (
        <>
            <h2>Personal Info</h2>
            <label>
                <span>First name</span>
                <input {...register('firstName')} autoFocus />
                {errors.firstName && (
                    <p className="error">{errors.firstName.message}</p>
                )}
            </label>
            <label>
                <span>Last name</span>
                <input {...register('lastName')} />
                {errors.lastName && (
                    <p className="error">{errors.lastName.message}</p>
                )}
            </label>
        </>
    );
}

// ---------------------------------------------------------------------------
// Step 2 — Account setup (username + password with cross-field confirmation)
// ---------------------------------------------------------------------------

function AccountStep() {
    const {
        register,
        formState: { errors }
    } = useComposedFormContext<FormValues>();

    return (
        <>
            <h2>Set Up Account</h2>
            <label>
                <span>Username</span>
                <input
                    {...register('username')}
                    autoComplete="username"
                    placeholder="e.g. jane_doe"
                />
                {errors.username && (
                    <p className="error">{errors.username.message}</p>
                )}
            </label>
            <label>
                <span>Password</span>
                <input
                    type="password"
                    {...register('password')}
                    autoComplete="new-password"
                />
                {errors.password && (
                    <p className="error">{errors.password.message}</p>
                )}
            </label>
            <label>
                <span>Confirm password</span>
                <input
                    type="password"
                    {...register('confirmPassword')}
                    autoComplete="new-password"
                />
                {errors.confirmPassword && (
                    <p className="error">{errors.confirmPassword.message}</p>
                )}
            </label>
        </>
    );
}

// ---------------------------------------------------------------------------
// Step 3 — Plan selection
// ---------------------------------------------------------------------------

function PlanStep() {
    const {
        register,
        formState: { errors }
    } = useComposedFormContext<FormValues>();

    return (
        <>
            <h2>Choose a Plan</h2>
            <label>
                <span>Plan</span>
                <select {...register('plan')}>
                    <option value="">— select —</option>
                    <option value="free">Free</option>
                    <option value="pro">Pro ($9 / mo)</option>
                </select>
                {errors.plan && <p className="error">{errors.plan.message}</p>}
            </label>
        </>
    );
}

// ---------------------------------------------------------------------------
// Step 4 — Billing (conditional: only shown when plan === "pro")
// ---------------------------------------------------------------------------

function BillingStep() {
    const {
        register,
        formState: { errors }
    } = useComposedFormContext<FormValues>();

    return (
        <>
            <h2>Billing</h2>
            <label>
                <span>Card number</span>
                <input
                    {...register('cardNumber')}
                    placeholder="4242 4242 4242 4242"
                    autoComplete="cc-number"
                />
                {errors.cardNumber && (
                    <p className="error">{errors.cardNumber.message}</p>
                )}
            </label>
        </>
    );
}

// ---------------------------------------------------------------------------
// Step 5 — Review
// Reads all current values via useWatch (reactive) and lets the user jump
// back to any section via goTo() before submitting.
// ---------------------------------------------------------------------------

function ReviewStep() {
    const { goTo } = useComposedFormContext<FormValues>();
    // useWatch with no args returns all current form values reactively.
    const values = useWatch<FormValues>() as FormValues;

    return (
        <>
            <h2>Review &amp; Submit</h2>
            <p className="review-hint">
                Everything look good? Hit Submit — or click Edit to go back and
                change anything.
            </p>

            <div className="review-section">
                <div className="review-header">
                    <strong>Personal</strong>
                    <button
                        type="button"
                        className="link"
                        onClick={() => goTo('personal')}
                    >
                        Edit
                    </button>
                </div>
                <div className="review-row">
                    <span>Name</span>
                    <span>
                        {values.firstName} {values.lastName}
                    </span>
                </div>
            </div>

            <div className="review-section">
                <div className="review-header">
                    <strong>Account</strong>
                    <button
                        type="button"
                        className="link"
                        onClick={() => goTo('account')}
                    >
                        Edit
                    </button>
                </div>
                <div className="review-row">
                    <span>Username</span>
                    <span>{values.username}</span>
                </div>
                <div className="review-row">
                    <span>Password</span>
                    <span>{'•'.repeat(8)}</span>
                </div>
            </div>

            <div className="review-section">
                <div className="review-header">
                    <strong>Plan</strong>
                    <button
                        type="button"
                        className="link"
                        onClick={() => goTo('plan')}
                    >
                        Edit
                    </button>
                </div>
                <div className="review-row">
                    <span>Plan</span>
                    <span style={{ textTransform: 'capitalize' }}>
                        {values.plan}
                    </span>
                </div>
                {values.plan === 'pro' && (
                    <div className="review-row">
                        <span>Card</span>
                        <span>
                            {'•••• •••• •••• '}
                            {values.cardNumber?.slice(-4) ?? '----'}
                        </span>
                    </div>
                )}
            </div>
        </>
    );
}

// ---------------------------------------------------------------------------
// Root App
// ---------------------------------------------------------------------------

function App() {
    const [submitted, setSubmitted] = useState<FormValues | null>(null);

    if (submitted) {
        return (
            <>
                <h2>✓ Submitted!</h2>
                <pre>
                    {JSON.stringify(
                        {
                            ...submitted,
                            password: '••••••••',
                            confirmPassword: undefined
                        },
                        null,
                        2
                    )}
                </pre>
                <button onClick={() => setSubmitted(null)}>Start over</button>
            </>
        );
    }

    return (
        <ComposedForm
            schema={schema}
            defaultValues={{ plan: 'free' }}
            onSubmit={(data) => setSubmitted(data)}
        >
            <StepIndicator />

            <Step name="personal">
                <PersonalStep />
            </Step>

            <Step name="account">
                <AccountStep />
            </Step>

            <Step name="plan">
                <PlanStep />
            </Step>

            {/* Disappears from navigation when plan !== "pro" */}
            <Step name="billing" enabledWhen={(v) => v.plan === 'pro'}>
                <BillingStep />
            </Step>

            <Step name="review">
                <ReviewStep />
            </Step>

            <NavBar />
        </ComposedForm>
    );
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------

const container = document.getElementById('root')!;
createRoot(container).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
