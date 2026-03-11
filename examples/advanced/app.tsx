/**
 * Advanced composed-form example — "Orbital" Project Setup Wizard
 *
 * Every library export is exercised here:
 *
 *  ComposedForm   ─ schema, defaultValues, onSubmit, onSubmitStep (async)
 *  Step           ─ enabled (dynamic: team step skipped for solo projects)
 *  useComposedFormContext ─ register, formState, submitStep,
 *                           goToPreviousStep, goToStep, isFirstStep,
 *                           isLastStep, currentStepName, form (raw RHF ref)
 *  useStep        ─ stepCount, stepPosition, steps, currentStepName
 *  useFieldArray  ─ technologies (Stack), members (Team), milestones (Planning)
 *  Controller     ─ project type, tech role chips, priority, notify.channel
 *  useController  ─ notify.onDeploy / onMerge / onFail toggle switches
 *  useFormContext ─ CharCount sub-component (pure RHF, no wizard context needed)
 *  useFormState   ─ isSubmitting (WizardNav), dirtyFields (BasicsStep slug dot)
 *  useWatch       ─ auto-derive slug; team-size gate; reactive review values
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { z } from 'zod';
import {
    ComposedForm,
    Controller,
    Step,
    useComposedFormContext,
    useController,
    useFieldArray,
    useFormContext,
    useFormState,
    useStep,
    useWatch
} from 'composed-form';
import type { SubmitHandler } from 'composed-form';


const schema = z.object({
    // Step 1 — Basics
    name: z.string().min(2, 'Project name must be at least 2 characters'),
    slug: z
        .string()
        .min(2, 'Slug required')
        .regex(
            /^[a-z0-9][a-z0-9-]*$/,
            'Lowercase letters, numbers, hyphens only'
        ),
    description: z.string().min(20, 'Add at least 20 characters'),
    type: z.enum(['web', 'mobile', 'api', 'data', 'cli', 'other'], {
        message: 'Select a project type'
    }),
    teamSize: z.enum(['solo', 'small', 'large'], {
        message: 'Select a team size'
    }),

    // Step 2 — Stack
    technologies: z
        .array(
            z.object({
                name: z.string().min(1, 'Required'),
                role: z.enum(['primary', 'secondary', 'tooling'])
            })
        )
        .min(1, 'Add at least one technology'),
    repository: z
        .string()
        .url('Must be a valid URL')
        .optional()
        .or(z.literal('')),

    // Step 3 — Team (conditional: disabled when teamSize is "solo")
    members: z
        .array(
            z.object({
                name: z.string().min(1, 'Name required'),
                email: z.string().email('Invalid email'),
                role: z.string().min(1, 'Role required')
            })
        )
        .optional(),

    // Step 4 — Planning (milestones)
    milestones: z
        .array(
            z.object({
                title: z.string().min(1, 'Title required'),
                date: z.string().min(1, 'Date required'),
                priority: z.enum(['low', 'medium', 'high'])
            })
        )
        .optional(),

    // Step 5 — Notifications
    notify: z.object({
        onDeploy: z.boolean(),
        onMerge: z.boolean(),
        onFail: z.boolean(),
        channel: z.enum(['email', 'slack', 'both', 'none'])
    })
});

type FormValues = z.infer<typeof schema>;


const PROJECT_TYPES = [
    { value: 'web', label: 'Web App', icon: '🌐' },
    { value: 'mobile', label: 'Mobile', icon: '📱' },
    { value: 'api', label: 'API', icon: '⚡' },
    { value: 'data', label: 'Data', icon: '📊' },
    { value: 'cli', label: 'CLI', icon: '⌨️' },
    { value: 'other', label: 'Other', icon: '✦' }
] as const;

const TEAM_SIZES = [
    { value: 'solo', label: 'Solo', sub: 'just me' },
    { value: 'small', label: 'Small', sub: '2 – 8' },
    { value: 'large', label: 'Large', sub: '9+' }
] as const;

const CHANNELS = [
    { value: 'email', label: 'Email', icon: '📧' },
    { value: 'slack', label: 'Slack', icon: '💬' },
    { value: 'both', label: 'Both', icon: '🔔' },
    { value: 'none', label: 'None', icon: '🔕' }
] as const;

const STEP_META: Record<string, { label: string; subtitle: string }> = {
    basics: { label: 'Basics', subtitle: 'Name and classify the project' },
    stack: { label: 'Stack', subtitle: 'Languages, frameworks and tools' },
    team: { label: 'Team', subtitle: 'Add collaborators' },
    planning: { label: 'Planning', subtitle: 'Key milestones (optional)' },
    notifications: { label: 'Notify', subtitle: 'How you want to be alerted' },
    review: { label: 'Review', subtitle: 'Confirm everything and launch' }
};


function toSlug(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-/, '');
}


// Demonstrates useFormContext (re-exported from RHF): this component only
// needs the RHF form layer, not the wizard context.
function CharCount({
    field,
    max
}: {
    field: 'name' | 'description';
    max: number;
}) {
    const { watch } = useFormContext<FormValues>();
    const value = watch(field) ?? '';
    return (
        <span className={`char-count${value.length > max ? ' over' : ''}`}>
            {value.length}/{max}
        </span>
    );
}

// Type selector rendered by <Controller>.
function TypeGrid({
    value,
    onChange
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="type-grid">
            {PROJECT_TYPES.map((t) => (
                <button
                    key={t.value}
                    type="button"
                    className={`type-btn${value === t.value ? ' selected' : ''}`}
                    onClick={() => onChange(t.value)}
                >
                    <span className="type-icon">{t.icon}</span>
                    {t.label}
                </button>
            ))}
        </div>
    );
}

// Team-size selector rendered by <Controller>.
function TeamSizeSelector({
    value,
    onChange
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="size-grid">
            {TEAM_SIZES.map((s) => (
                <button
                    key={s.value}
                    type="button"
                    className={`size-btn${value === s.value ? ' selected' : ''}`}
                    onClick={() => onChange(s.value)}
                >
                    {s.label}
                    <span className="size-sub">{s.sub}</span>
                </button>
            ))}
        </div>
    );
}

// Channel selector rendered by <Controller>.
function ChannelSelector({
    value,
    onChange
}: {
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="channel-grid">
            {CHANNELS.map((c) => (
                <button
                    key={c.value}
                    type="button"
                    className={`channel-btn${value === c.value ? ' selected' : ''}`}
                    onClick={() => onChange(c.value)}
                >
                    <span className="channel-icon">{c.icon}</span>
                    {c.label}
                </button>
            ))}
        </div>
    );
}

// Toggle switch driven by useController.
function NotifyToggle({
    name,
    label,
    description
}: {
    name: 'notify.onDeploy' | 'notify.onMerge' | 'notify.onFail';
    label: string;
    description: string;
}) {
    // useController: subscribes to a single field, renders a custom input.
    const { field } = useController<FormValues>({ name });

    return (
        <div className="toggle-row">
            <div className="toggle-info">
                <div className="toggle-label">{label}</div>
                <div className="toggle-desc">{description}</div>
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={field.value as boolean}
                className={`toggle-switch${field.value ? ' on' : ''}`}
                onClick={() => field.onChange(!field.value)}
                onBlur={field.onBlur}
            />
        </div>
    );
}


function BasicsStep() {
    const {
        register,
        // formState from useComposedFormContext gives access to errors + dirty tracking
        formState: { errors, dirtyFields },
        // form: direct RHF UseFormReturn — used here to call setValue programmatically
        form
    } = useComposedFormContext<FormValues>();

    // useWatch: subscribe to 'name' to auto-derive slug
    const nameValue = useWatch<FormValues, 'name'>({ name: 'name' });

    // Track whether the user has manually edited the slug so we stop auto-filling.
    const slugManual = useRef(false);

    useEffect(() => {
        if (!slugManual.current) {
            // form.setValue: direct RHF call, demonstrating the form ref
            form.setValue('slug', toSlug(nameValue ?? ''));
        }
    }, [nameValue, form]);

    return (
        <>
            {/* name field */}
            <div className="field">
                <div className="field-meta">
                    <label className="field-label">
                        Project name
                        {/* useFormState dirtyFields: show unsaved-changes dot */}
                        {dirtyFields.name && (
                            <span
                                className="dirty-dot"
                                title="Unsaved changes"
                            />
                        )}
                    </label>
                    {/* CharCount uses useFormContext directly — no wizard context */}
                    <CharCount field="name" max={60} />
                </div>
                <input
                    className="input"
                    {...register('name')}
                    placeholder="My Awesome Project"
                    autoFocus
                />
                {errors.name && (
                    <p className="field-error">{errors.name.message}</p>
                )}
            </div>

            {/* slug field — auto-filled from name, or manually editable */}
            <div className="field">
                <label className="field-label">Slug</label>
                <div className="input-row">
                    <span className="input-prefix">orbital.dev/</span>
                    <input
                        className="input mono"
                        {...register('slug')}
                        placeholder="my-awesome-project"
                        onFocus={() => {
                            slugManual.current = true;
                        }}
                    />
                </div>
                {errors.slug && (
                    <p className="field-error">{errors.slug.message}</p>
                )}
                <p className="field-hint">
                    Auto-filled from name. Edit manually to override.
                    {/* Demonstrate form.setValue via a button */}{' '}
                    <button
                        type="button"
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '0.78rem',
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            padding: 0
                        }}
                        onClick={() => {
                            slugManual.current = false;
                            form.setValue('slug', toSlug(nameValue ?? ''));
                        }}
                    >
                        ↺ reset
                    </button>
                </p>
            </div>

            {/* description */}
            <div className="field">
                <div className="field-meta">
                    <label className="field-label">Description</label>
                    <CharCount field="description" max={200} />
                </div>
                <textarea
                    className="input"
                    rows={3}
                    {...register('description')}
                    placeholder="What does this project do?"
                />
                {errors.description && (
                    <p className="field-error">{errors.description.message}</p>
                )}
            </div>

            {/* type — Controller renders a custom button grid */}
            <div className="field">
                <label className="field-label">Project type</label>
                <Controller<FormValues>
                    name="type"
                    render={({ field }) => (
                        <TypeGrid
                            value={field.value as string}
                            onChange={field.onChange}
                        />
                    )}
                />
                {errors.type && (
                    <p className="field-error">{errors.type.message}</p>
                )}
            </div>

            {/* teamSize — another Controller, different visual treatment */}
            <div className="field">
                <label className="field-label">Team size</label>
                <Controller<FormValues>
                    name="teamSize"
                    render={({ field }) => (
                        <TeamSizeSelector
                            value={field.value as string}
                            onChange={field.onChange}
                        />
                    )}
                />
                <p className="field-hint">
                    Solo projects skip the Team step entirely.
                </p>
                {errors.teamSize && (
                    <p className="field-error">{errors.teamSize.message}</p>
                )}
            </div>
        </>
    );
}


function StackStep() {
    const {
        register,
        formState: { errors }
    } = useComposedFormContext<FormValues>();

    // useFieldArray: manages a dynamic list of { name, role } objects
    const { fields, append, remove } = useFieldArray<FormValues>({
        name: 'technologies'
    });

    return (
        <>
            <div className="field">
                <label className="field-label">Technologies</label>
                <div className="array-rows">
                    {fields.map((field, idx) => (
                        <div key={field.id} className="array-row">
                            <span className="array-row-num">{idx + 1}.</span>

                            {/* register with dot-path into the array item */}
                            <input
                                className="input mono"
                                {...register(`technologies.${idx}.name`)}
                                placeholder="React, Postgres, Rust…"
                            />

                            {/* Controller for the role chip-group inside each row */}
                            <Controller<FormValues>
                                name={`technologies.${idx}.role`}
                                render={({ field: roleField }) => (
                                    <div className="role-chips">
                                        {(
                                            [
                                                'primary',
                                                'secondary',
                                                'tooling'
                                            ] as const
                                        ).map((r) => (
                                            <button
                                                key={r}
                                                type="button"
                                                className={`role-chip ${r}${roleField.value === r ? ' selected' : ''}`}
                                                onClick={() =>
                                                    roleField.onChange(r)
                                                }
                                            >
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            />

                            <button
                                type="button"
                                className="array-row-remove"
                                onClick={() => remove(idx)}
                                aria-label="Remove"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>

                <button
                    type="button"
                    className="add-row-btn"
                    onClick={() => append({ name: '', role: 'primary' })}
                >
                    + Add technology
                </button>

                {errors.technologies?.root && (
                    <p className="field-error">
                        {errors.technologies.root.message}
                    </p>
                )}
            </div>

            {/* repository — optional URL field */}
            <div className="field">
                <label className="field-label">
                    Repository <span className="optional">optional</span>
                </label>
                <input
                    className="input mono"
                    {...register('repository')}
                    placeholder="https://github.com/org/repo"
                />
                {errors.repository && (
                    <p className="field-error">{errors.repository.message}</p>
                )}
            </div>
        </>
    );
}


function TeamStep() {
    const {
        register,
        formState: { errors }
    } = useComposedFormContext<FormValues>();

    // useFieldArray for team members
    const { fields, append, remove } = useFieldArray<FormValues>({
        name: 'members'
    });

    return (
        <>
            <div className="field">
                <label className="field-label">Team members</label>
                <div className="array-rows">
                    {fields.map((field, idx) => (
                        <div
                            key={field.id}
                            className="array-row"
                            style={{ flexWrap: 'wrap', gap: '0.4rem' }}
                        >
                            <span className="array-row-num">{idx + 1}.</span>
                            <input
                                className="input"
                                style={{ flex: '2 1 120px', minWidth: 0 }}
                                {...register(`members.${idx}.name`)}
                                placeholder="Full name"
                            />
                            <input
                                className="input"
                                style={{ flex: '3 1 160px', minWidth: 0 }}
                                {...register(`members.${idx}.email`)}
                                placeholder="email@example.com"
                                type="email"
                            />
                            <input
                                className="input"
                                style={{ flex: '2 1 100px', minWidth: 0 }}
                                {...register(`members.${idx}.role`)}
                                placeholder="Role"
                            />
                            <button
                                type="button"
                                className="array-row-remove"
                                onClick={() => remove(idx)}
                                aria-label="Remove member"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>

                <button
                    type="button"
                    className="add-row-btn"
                    onClick={() => append({ name: '', email: '', role: '' })}
                >
                    + Add member
                </button>

                {/* Per-item errors */}
                {errors.members?.map &&
                    errors.members.map((err, idx) =>
                        err ? (
                            <p key={idx} className="field-error">
                                Member {idx + 1}:{' '}
                                {err.name?.message ??
                                    err.email?.message ??
                                    err.role?.message}
                            </p>
                        ) : null
                    )}
            </div>
        </>
    );
}


function PlanningStep() {
    const {
        register,
        formState: { errors }
    } = useComposedFormContext<FormValues>();

    // Third useFieldArray usage
    const { fields, append, remove } = useFieldArray<FormValues>({
        name: 'milestones'
    });

    return (
        <>
            <div className="field">
                <label className="field-label">
                    Milestones <span className="optional">optional</span>
                </label>
                <p className="field-hint">
                    Add key deadlines. Leave empty to skip.
                </p>

                <div className="array-rows" style={{ marginTop: '0.5rem' }}>
                    {fields.map((field, idx) => (
                        <div
                            key={field.id}
                            className="array-row"
                            style={{ flexWrap: 'wrap', gap: '0.4rem' }}
                        >
                            <span className="array-row-num">{idx + 1}.</span>
                            <input
                                className="input"
                                style={{ flex: '3 1 150px', minWidth: 0 }}
                                {...register(`milestones.${idx}.title`)}
                                placeholder="e.g. Public beta"
                            />
                            <input
                                className="input mono"
                                style={{ flex: '1 1 120px', minWidth: 0 }}
                                type="date"
                                {...register(`milestones.${idx}.date`)}
                            />

                            {/* Controller for priority chips */}
                            <Controller<FormValues>
                                name={`milestones.${idx}.priority`}
                                render={({ field: pField }) => (
                                    <div className="priority-chips">
                                        {(
                                            ['high', 'medium', 'low'] as const
                                        ).map((p) => (
                                            <button
                                                key={p}
                                                type="button"
                                                className={`priority-chip ${p}${pField.value === p ? ' selected' : ''}`}
                                                onClick={() =>
                                                    pField.onChange(p)
                                                }
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            />

                            <button
                                type="button"
                                className="array-row-remove"
                                onClick={() => remove(idx)}
                                aria-label="Remove milestone"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>

                <button
                    type="button"
                    className="add-row-btn"
                    onClick={() =>
                        append({ title: '', date: '', priority: 'medium' })
                    }
                >
                    + Add milestone
                </button>
            </div>
        </>
    );
}


function NotificationsStep() {
    const {
        formState: { errors }
    } = useComposedFormContext<FormValues>();

    return (
        <>
            {/* useController for each toggle (three separate controlled inputs) */}
            <div className="field">
                <label className="field-label">Alert me when…</label>
                <NotifyToggle
                    name="notify.onDeploy"
                    label="Deployment completes"
                    description="Trigger on successful and failed deploys"
                />
                <NotifyToggle
                    name="notify.onMerge"
                    label="Pull request merged"
                    description="Any merge into the default branch"
                />
                <NotifyToggle
                    name="notify.onFail"
                    label="Build or test fails"
                    description="CI failures and runtime errors"
                />
            </div>

            {/* Controller for channel radio group */}
            <div className="field">
                <label className="field-label">Delivery channel</label>
                <Controller<FormValues>
                    name="notify.channel"
                    render={({ field }) => (
                        <ChannelSelector
                            value={field.value as string}
                            onChange={field.onChange}
                        />
                    )}
                />
                {errors.notify?.channel && (
                    <p className="field-error">
                        {errors.notify.channel.message}
                    </p>
                )}
            </div>
        </>
    );
}


function ReviewStep() {
    // goToStep allows jumping back to any section
    const { goToStep } = useComposedFormContext<FormValues>();

    // useWatch with no args: subscribe to all current form values reactively
    const values = useWatch<FormValues>() as FormValues;
    const techList = values.technologies ?? [];
    const members = values.members ?? [];
    const milestones = values.milestones ?? [];
    const notify = values.notify ?? {};

    return (
        <>
            {/* Basics */}
            <div className="review-section">
                <div className="review-section-header">
                    <span className="review-section-title">Basics</span>
                    <button
                        className="review-edit-btn"
                        type="button"
                        onClick={() => goToStep('basics')}
                    >
                        Edit
                    </button>
                </div>
                <ReviewRow label="Name" value={values.name} />
                <ReviewRow
                    label="Slug"
                    value={`orbital.dev/${values.slug}`}
                    mono
                />
                <ReviewRow label="Type" value={values.type} />
                <ReviewRow label="Team" value={values.teamSize} />
            </div>

            {/* Stack */}
            <div className="review-section">
                <div className="review-section-header">
                    <span className="review-section-title">Stack</span>
                    <button
                        className="review-edit-btn"
                        type="button"
                        onClick={() => goToStep('stack')}
                    >
                        Edit
                    </button>
                </div>
                <div className="review-row">
                    <span className="review-key">Technologies</span>
                    <div className="review-tag-list">
                        {techList.map((t, i) => (
                            <span
                                key={i}
                                className="review-tag"
                                style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.72rem'
                                }}
                            >
                                {t.name}{' '}
                                <span style={{ opacity: 0.5 }}>{t.role}</span>
                            </span>
                        ))}
                        {techList.length === 0 && (
                            <span
                                className="review-val"
                                style={{ opacity: 0.4 }}
                            >
                                —
                            </span>
                        )}
                    </div>
                </div>
                {values.repository && (
                    <ReviewRow label="Repo" value={values.repository} mono />
                )}
            </div>

            {/* Team — only shown when there are members */}
            {members.length > 0 && (
                <div className="review-section">
                    <div className="review-section-header">
                        <span className="review-section-title">Team</span>
                        <button
                            className="review-edit-btn"
                            type="button"
                            onClick={() => goToStep('team')}
                        >
                            Edit
                        </button>
                    </div>
                    {members.map((m, i) => (
                        <ReviewRow
                            key={i}
                            label={m.role || `Member ${i + 1}`}
                            value={`${m.name} <${m.email}>`}
                            mono
                        />
                    ))}
                </div>
            )}

            {/* Milestones */}
            {milestones.length > 0 && (
                <div className="review-section">
                    <div className="review-section-header">
                        <span className="review-section-title">Milestones</span>
                        <button
                            className="review-edit-btn"
                            type="button"
                            onClick={() => goToStep('planning')}
                        >
                            Edit
                        </button>
                    </div>
                    {milestones.map((m, i) => (
                        <ReviewRow
                            key={i}
                            label={m.date}
                            value={`${m.title} (${m.priority})`}
                        />
                    ))}
                </div>
            )}

            {/* Notifications */}
            <div className="review-section">
                <div className="review-section-header">
                    <span className="review-section-title">Notifications</span>
                    <button
                        className="review-edit-btn"
                        type="button"
                        onClick={() => goToStep('notifications')}
                    >
                        Edit
                    </button>
                </div>
                <ReviewRow
                    label="Channel"
                    value={String(notify.channel ?? '—')}
                />
                <div className="review-row">
                    <span className="review-key">Triggers</span>
                    <div className="review-tag-list">
                        {notify.onDeploy && (
                            <span className="review-tag">deploys</span>
                        )}
                        {notify.onMerge && (
                            <span className="review-tag">merges</span>
                        )}
                        {notify.onFail && (
                            <span className="review-tag">failures</span>
                        )}
                        {!notify.onDeploy &&
                            !notify.onMerge &&
                            !notify.onFail && (
                                <span
                                    className="review-val"
                                    style={{ opacity: 0.4 }}
                                >
                                    none
                                </span>
                            )}
                    </div>
                </div>
            </div>
        </>
    );
}

function ReviewRow({
    label,
    value,
    mono = false
}: {
    label: string;
    value: string | undefined;
    mono?: boolean;
}) {
    return (
        <div className="review-row">
            <span className="review-key">{label}</span>
            <span
                className="review-val"
                style={mono ? undefined : { fontFamily: 'var(--font)' }}
            >
                {value || <span style={{ opacity: 0.35 }}>—</span>}
            </span>
        </div>
    );
}


function ProgressRail({ savedSteps }: { savedSteps: Set<string> }) {
    // useStep: stepCount, stepPosition — dedicated hook for step metadata
    const { steps, stepCount, stepPosition, currentStepName } = useStep();

    // useComposedFormContext for goToStep action
    const { goToStep } = useComposedFormContext<FormValues>();

    const enabledSteps = steps.filter((s) => s.isEnabled);

    return (
        <div
            className="progress-rail"
            aria-label={`Step ${stepPosition} of ${stepCount}`}
        >
            {enabledSteps.map((step, i) => {
                const isActive = step.name === currentStepName;
                const isCompleted = i < stepPosition - 1;
                const isSaved = savedSteps.has(step.name);

                return (
                    <div
                        key={step.name}
                        className={[
                            'progress-step',
                            isActive ? 'active' : '',
                            isCompleted ? 'completed' : '',
                            isSaved ? 'saved' : '',
                            isCompleted || isSaved ? 'clickable' : ''
                        ]
                            .filter(Boolean)
                            .join(' ')}
                        onClick={() => {
                            if (isCompleted || isSaved) goToStep(step.name);
                        }}
                        title={
                            isCompleted || isSaved
                                ? `Back to ${STEP_META[step.name]?.label ?? step.name}`
                                : undefined
                        }
                    >
                        <div className="progress-dot">{!isSaved && i + 1}</div>
                        <span className="progress-label">
                            {STEP_META[step.name]?.label ?? step.name}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}


function WizardNav({ savedBadge }: { savedBadge: boolean }) {
    const { submitStep, goToPreviousStep, isFirstStep, isLastStep } =
        useComposedFormContext<FormValues>();

    // useFormState: subscribes only to isSubmitting — avoids re-renders on error changes
    const { isSubmitting } = useFormState<FormValues>();

    return (
        <div className="wizard-nav">
            <button
                type="button"
                className="btn btn-secondary"
                onClick={goToPreviousStep}
                disabled={isFirstStep || isSubmitting}
            >
                ← Back
            </button>

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                }}
            >
                {savedBadge && <span className="save-badge">✓ Step saved</span>}
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void submitStep()}
                    disabled={isSubmitting}
                >
                    {isSubmitting
                        ? '…'
                        : isLastStep
                          ? '🚀 Launch project'
                          : 'Next →'}
                </button>
            </div>
        </div>
    );
}


const defaultValues: Partial<FormValues> = {
    name: '',
    slug: '',
    description: '',
    type: 'web',
    teamSize: 'small',
    technologies: [{ name: '', role: 'primary' }],
    repository: '',
    members: [],
    milestones: [],
    notify: {
        onDeploy: true,
        onMerge: false,
        onFail: true,
        channel: 'email'
    }
};

function App() {
    const [submitted, setSubmitted] = useState<FormValues | null>(null);
    const [savedSteps, setSavedSteps] = useState<Set<string>>(new Set());
    const [savedBadge, setSavedBadge] = useState(false);

    // teamSize is watched at the App level to control the Team step's enabled prop.
    // It lives outside ComposedForm so we use a state variable updated by PlanWatcher.
    const [teamSize, setTeamSize] = useState<string>('small');

    // onSubmitStep: async per-step callback — simulates saving draft to server.
    // Demonstrates: async onSubmitStep, partial step values with nested paths.
    const handleStepSave = useCallback(
        async (stepName: string, _values: Partial<FormValues>) => {
            await new Promise<void>((resolve) => setTimeout(resolve, 350)); // sim. network
            setSavedSteps((prev) => {
                const next = new Set(prev);
                next.add(stepName);
                return next;
            });
            setSavedBadge(true);
            setTimeout(() => setSavedBadge(false), 2500);
        },
        []
    );

    const handleSubmit: SubmitHandler<FormValues> = useCallback((data) => {
        setSubmitted(data);
    }, []);

    if (submitted) {
        return (
            <div className="wizard-wrap">
                <div className="wizard-brand">
                    <div className="wizard-brand-mark" />
                    <span className="wizard-brand-name">Orbital</span>
                </div>
                <div className="step-card">
                    <div className="success-wrap">
                        <div className="success-icon">🚀</div>
                        <h1 className="success-title">
                            {submitted.name} is live!
                        </h1>
                        <p className="success-sub">
                            Your project has been created at{' '}
                            <span
                                style={{
                                    fontFamily: 'var(--font-mono)',
                                    color: 'var(--accent)'
                                }}
                            >
                                orbital.dev/{submitted.slug}
                            </span>
                        </p>
                        <pre className="success-payload">
                            {JSON.stringify(submitted, null, 2)}
                        </pre>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                                setSubmitted(null);
                                setSavedSteps(new Set());
                            }}
                        >
                            ↩ Start over
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="wizard-wrap">
            {/* Brand */}
            <div className="wizard-brand">
                <div className="wizard-brand-mark" />
                <span className="wizard-brand-name">Orbital</span>
                <span className="wizard-brand-sep">/</span>
                <span className="wizard-brand-page">New project</span>
            </div>

            {/*
             * ComposedForm:
             *   schema       — Zod schema, auto-wires zodResolver
             *   defaultValues — pre-fills the form; NoInfer keeps TValues = z.infer<schema>
             *   onSubmit     — final validated submit
             *   onSubmitStep — async per-step save (called after each step validates)
             */}
            <ComposedForm
                schema={schema}
                defaultValues={defaultValues}
                onSubmit={handleSubmit}
                onSubmitStep={handleStepSave}
            >
                {/*
                 * PlanWatcher lives inside ComposedForm so it can access the form context.
                 * It uses useWatch to sync teamSize into App state for the Team step's
                 * enabled prop — showing how to bridge inner form state to outer React state.
                 */}
                <TeamSizeWatcher onChange={setTeamSize} />

                <div className="step-card">
                    {/* StepHeader is shared; reads currentStepName from context */}
                    <StepHeader />

                    <div className="step-body">
                        {/*
                         * Step components are always mounted (display:none when inactive)
                         * so RHF field state is preserved across navigation.
                         */}
                        <Step name="basics">
                            <BasicsStep />
                        </Step>

                        <Step name="stack">
                            <StackStep />
                        </Step>

                        {/*
                         * Step enabled=… dynamic: this step is completely skipped
                         * (removed from navigation) when teamSize is "solo".
                         */}
                        <Step name="team" enabled={teamSize !== 'solo'}>
                            <TeamStep />
                        </Step>

                        <Step name="planning">
                            <PlanningStep />
                        </Step>

                        <Step name="notifications">
                            <NotificationsStep />
                        </Step>

                        <Step name="review">
                            <ReviewStep />
                        </Step>
                    </div>

                    {/* Progress rail sits inside ComposedForm so it can use useStep */}
                    <ProgressRail savedSteps={savedSteps} />

                    <WizardNav savedBadge={savedBadge} />
                </div>
            </ComposedForm>
        </div>
    );
}

// Reads teamSize via useWatch to notify the parent App.
function TeamSizeWatcher({ onChange }: { onChange: (v: string) => void }) {
    const teamSize = useWatch<FormValues, 'teamSize'>({ name: 'teamSize' });

    useEffect(() => {
        if (teamSize) onChange(teamSize);
    }, [teamSize, onChange]);

    return null;
}

// Step header — reads current step metadata from useStep / useComposedFormContext.
function StepHeader() {
    const { stepPosition, stepCount, currentStepName } = useStep();
    const meta = STEP_META[currentStepName];

    return (
        <div className="step-header">
            <div className="step-header-left">
                <div className="step-super">
                    {meta?.label ?? currentStepName}
                </div>
                <h2 className="step-title">{meta?.subtitle ?? ''}</h2>
            </div>
            <div className="step-position">
                {stepPosition}/{stepCount}
            </div>
        </div>
    );
}


const container = document.getElementById('root')!;

createRoot(container).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
