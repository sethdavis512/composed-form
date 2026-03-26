/**
 * Advanced composed-form example -- Event Planning Wizard
 *
 * Every library export is exercised here:
 *
 *  ComposedForm          -- schema, defaultValues, onSubmit, onSubmitStep (async)
 *  Step                  -- enabled (dynamic: 3 conditional steps)
 *  useComposedFormContext -- register, formState, submitStep, goToPreviousStep,
 *                           goToStep, isFirstStep, isLastStep, currentStepName,
 *                           form (raw RHF), watch, setValue
 *  useStep               -- stepCount, stepPosition, steps, currentStepName
 *  useFieldArray          -- schedule (Dates), speakers (Speakers), sponsors (Ticketing)
 *  Controller            -- event type cards, format cards, channel select
 *  useController         -- toggle switches for notify booleans
 *  useFormContext         -- CharCount sub-component (pure RHF, no wizard context)
 *  useFormState           -- isSubmitting (NavBar), dirtyFields (StepIndicator)
 *  useWatch              -- auto-derive slug, total schedule duration, review values,
 *                           conditional step watchers
 *  SubmitHandler (type)  -- typed onSubmit callback
 */

import React, { useCallback, useEffect, useState } from 'react';
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

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z
    .object({
        // Step 1 -- Basics
        name: z
            .string()
            .min(2, 'Event name must be at least 2 characters')
            .max(80, 'Event name must be 80 characters or fewer'),
        slug: z
            .string()
            .min(2, 'Slug required')
            .regex(
                /^[a-z0-9][a-z0-9-]*$/,
                'Lowercase letters, numbers, hyphens only'
            ),
        description: z
            .string()
            .min(20, 'Add at least 20 characters')
            .max(500, 'Keep it under 500 characters'),
        type: z.enum(['conference', 'workshop', 'meetup', 'social'], {
            message: 'Select an event type'
        }),
        format: z.enum(['in-person', 'virtual', 'hybrid'], {
            message: 'Select a format'
        }),
        capacity: z.coerce.number().min(1, 'At least 1 attendee'),
        pricing: z.enum(['free', 'paid'], {
            message: 'Select pricing'
        }),

        // Step 2 -- Schedule
        startDate: z.string().min(1, 'Start date is required'),
        endDate: z.string().min(1, 'End date is required'),
        schedule: z
            .array(
                z.object({
                    time: z.string().min(1, 'Time required'),
                    title: z.string().min(1, 'Title required'),
                    duration: z.coerce.number().min(5, 'At least 5 minutes')
                })
            )
            .optional(),

        // Step 3 -- Speakers (conditional: conference | workshop)
        speakers: z
            .array(
                z.object({
                    name: z.string().min(1, 'Name required'),
                    email: z.string().email('Invalid email'),
                    topic: z.string().min(1, 'Topic required'),
                    bio: z.string().max(200).optional()
                })
            )
            .optional(),

        // Step 4 -- Venue (conditional: in-person | hybrid)
        venue: z
            .object({
                name: z.string().min(1, 'Venue name required'),
                address: z.string().min(1, 'Address required'),
                city: z.string().min(1, 'City required'),
                notes: z.string().optional()
            })
            .optional(),

        // Step 5 -- Ticketing (conditional: paid)
        ticketing: z
            .object({
                regularPrice: z.coerce.number().min(1, 'Set a price'),
                earlyBirdPrice: z.coerce.number().min(0, 'Cannot be negative'),
                earlyBirdDeadline: z.string().min(1, 'Deadline required')
            })
            .optional(),
        sponsors: z
            .array(
                z.object({
                    name: z.string().min(1, 'Sponsor name required'),
                    tier: z.enum(['gold', 'silver', 'bronze']),
                    amount: z.coerce.number().min(0, 'Cannot be negative')
                })
            )
            .optional(),

        // Step 6 -- Notifications
        notify: z.object({
            onRegistration: z.boolean(),
            onCapacity: z.boolean(),
            dailyDigest: z.boolean(),
            channel: z.enum(['email', 'sms', 'both', 'none'])
        })
    })
    .refine((d) => d.endDate >= d.startDate, {
        message: 'End date must be on or after start date',
        path: ['endDate']
    })
    .refine(
        (d) =>
            !d.ticketing ||
            d.ticketing.earlyBirdPrice < d.ticketing.regularPrice,
        {
            message: 'Early bird price must be less than regular price',
            path: ['ticketing.earlyBirdPrice']
        }
    );

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
    { value: 'conference', label: 'Conference' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'meetup', label: 'Meetup' },
    { value: 'social', label: 'Social' }
] as const;

const FORMATS = [
    { value: 'in-person', label: 'In-Person' },
    { value: 'virtual', label: 'Virtual' },
    { value: 'hybrid', label: 'Hybrid' }
] as const;

const CHANNELS = [
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
    { value: 'both', label: 'Both' },
    { value: 'none', label: 'None' }
] as const;

const STEP_LABELS: Record<string, string> = {
    basics: 'Basics',
    schedule: 'Schedule',
    speakers: 'Speakers',
    venue: 'Venue',
    ticketing: 'Ticketing',
    notifications: 'Notify',
    review: 'Review'
};

// Fields that belong to each step (for dirtyFields tracking in the indicator).
const STEP_FIELDS: Record<string, string[]> = {
    basics: ['name', 'slug', 'description', 'type', 'format', 'capacity', 'pricing'],
    schedule: ['startDate', 'endDate', 'schedule'],
    speakers: ['speakers'],
    venue: ['venue'],
    ticketing: ['ticketing', 'sponsors'],
    notifications: ['notify']
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toSlug(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-/, '');
}

// ---------------------------------------------------------------------------
// CharCount -- uses useFormContext (re-exported from RHF). Demonstrates that
// a sub-component can access the form without needing the wizard context.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ToggleSwitch -- uses useController to render a custom boolean input
// ---------------------------------------------------------------------------

function ToggleSwitch({
    name,
    label
}: {
    name: 'notify.onRegistration' | 'notify.onCapacity' | 'notify.dailyDigest';
    label: string;
}) {
    const { field } = useController<FormValues>({ name: name as never });

    return (
        <div className="toggle-row">
            <span className="toggle-label">{label}</span>
            <button
                type="button"
                className={`toggle${field.value ? ' on' : ''}`}
                onClick={() => field.onChange(!field.value)}
                aria-pressed={!!field.value}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// StepIndicator -- uses useStep for wizard state + useFormState for dirtyFields
// ---------------------------------------------------------------------------

function StepIndicator() {
    const { steps, currentStepName } = useStep();
    const { dirtyFields } = useFormState<FormValues>();
    const enabledSteps = steps.filter((s) => s.isEnabled);
    const currentIdx = enabledSteps.findIndex(
        (s) => s.name === currentStepName
    );

    const isDirty = (stepName: string): boolean => {
        const fields = STEP_FIELDS[stepName];
        if (!fields) return false;
        return fields.some((f) => (dirtyFields as Record<string, unknown>)[f]);
    };

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
                    {isDirty(step.name) && step.name !== currentStepName && (
                        <div className="dirty-dot" />
                    )}
                    <div className="dot" />
                    <span>{STEP_LABELS[step.name] ?? step.name}</span>
                </div>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// NavBar -- uses useFormState for isSubmitting
// ---------------------------------------------------------------------------

function NavBar() {
    const { goToPreviousStep, submitStep, isFirstStep, isLastStep } =
        useComposedFormContext<FormValues>();
    const { isSubmitting } = useFormState<FormValues>();

    return (
        <div className="nav">
            <button
                type="button"
                className="secondary"
                onClick={goToPreviousStep}
                disabled={isFirstStep}
            >
                Back
            </button>
            <button
                type="button"
                onClick={() => void submitStep()}
                disabled={isSubmitting}
            >
                {isLastStep
                    ? isSubmitting
                        ? 'Submitting...'
                        : 'Submit'
                    : 'Next'}
            </button>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Step 1 -- Basics
// ---------------------------------------------------------------------------

function BasicsStep() {
    const {
        register,
        formState: { errors },
        form
    } = useComposedFormContext<FormValues>();

    // Auto-derive slug from name via useWatch.
    const nameValue = useWatch<FormValues>({ name: 'name' }) as string;
    useEffect(() => {
        if (nameValue) {
            form.setValue('slug', toSlug(nameValue), { shouldDirty: true });
        }
    }, [nameValue, form]);

    return (
        <>
            <h2>Event Basics</h2>

            <label>
                <span>Event name</span>
                <input {...register('name')} autoFocus />
                <CharCount field="name" max={80} />
                {errors.name && (
                    <p className="error">{errors.name.message}</p>
                )}
            </label>

            <label>
                <span>Slug</span>
                <input {...register('slug')} placeholder="my-event" />
                <p className="hint">Auto-derived from name. Edit to customize.</p>
                {errors.slug && (
                    <p className="error">{errors.slug.message}</p>
                )}
            </label>

            <label>
                <span>Description</span>
                <textarea {...(register('description') as never)} rows={3} />
                <CharCount field="description" max={500} />
                {errors.description && (
                    <p className="error">{errors.description.message}</p>
                )}
            </label>

            <div>
                <span
                    style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        marginBottom: '0.25rem'
                    }}
                >
                    Event type
                </span>
                <Controller<FormValues>
                    name="type"
                    render={({ field }) => (
                        <div className="radio-group">
                            {EVENT_TYPES.map((t) => (
                                <button
                                    key={t.value}
                                    type="button"
                                    className={`radio-card${field.value === t.value ? ' selected' : ''}`}
                                    onClick={() => field.onChange(t.value)}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    )}
                />
                {errors.type && (
                    <p className="error">{errors.type.message}</p>
                )}
            </div>

            <div>
                <span
                    style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        marginBottom: '0.25rem'
                    }}
                >
                    Format
                </span>
                <Controller<FormValues>
                    name="format"
                    render={({ field }) => (
                        <div className="radio-group">
                            {FORMATS.map((f) => (
                                <button
                                    key={f.value}
                                    type="button"
                                    className={`radio-card${field.value === f.value ? ' selected' : ''}`}
                                    onClick={() => field.onChange(f.value)}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    )}
                />
                {errors.format && (
                    <p className="error">{errors.format.message}</p>
                )}
            </div>

            <label>
                <span>Capacity</span>
                <input type="number" {...register('capacity')} min={1} />
                {errors.capacity && (
                    <p className="error">{errors.capacity.message}</p>
                )}
            </label>

            <label>
                <span>Pricing</span>
                <select {...register('pricing')}>
                    <option value="">-- select --</option>
                    <option value="free">Free</option>
                    <option value="paid">Paid</option>
                </select>
                {errors.pricing && (
                    <p className="error">{errors.pricing.message}</p>
                )}
            </label>
        </>
    );
}

// ---------------------------------------------------------------------------
// Step 2 -- Schedule
// ---------------------------------------------------------------------------

function ScheduleStep() {
    const {
        register,
        formState: { errors }
    } = useComposedFormContext<FormValues>();

    const { fields, append, remove } = useFieldArray<FormValues>({
        name: 'schedule'
    });

    // Compute total duration reactively via useWatch.
    const scheduleItems = useWatch<FormValues>({ name: 'schedule' }) as
        | Array<{ duration?: number }>
        | undefined;
    const totalMinutes = (scheduleItems ?? []).reduce(
        (sum, item) => sum + (Number(item?.duration) || 0),
        0
    );
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    return (
        <>
            <h2>Dates & Schedule</h2>

            <label>
                <span>Start date</span>
                <input type="date" {...register('startDate')} />
                {errors.startDate && (
                    <p className="error">{errors.startDate.message}</p>
                )}
            </label>

            <label>
                <span>End date</span>
                <input type="date" {...register('endDate')} />
                {errors.endDate && (
                    <p className="error">{errors.endDate.message}</p>
                )}
            </label>

            <div style={{ marginTop: '1rem' }}>
                <span
                    style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        marginBottom: '0.5rem'
                    }}
                >
                    Schedule items
                    {totalMinutes > 0 && (
                        <span
                            style={{
                                fontWeight: 400,
                                color: '#6b7280',
                                marginLeft: '0.5rem'
                            }}
                        >
                            ({hours}h {mins}m total)
                        </span>
                    )}
                </span>

                {fields.map((field, index) => (
                    <div className="field-row" key={field.id}>
                        <input
                            type="time"
                            {...register(`schedule.${index}.time`)}
                            style={{ maxWidth: '6rem' }}
                        />
                        <input
                            {...register(`schedule.${index}.title`)}
                            placeholder="Session title"
                        />
                        <input
                            type="number"
                            {...register(`schedule.${index}.duration`)}
                            placeholder="Min"
                            min={5}
                            style={{ maxWidth: '4rem' }}
                        />
                        <button
                            type="button"
                            className="remove"
                            onClick={() => remove(index)}
                        >
                            X
                        </button>
                    </div>
                ))}
                {errors.schedule && !Array.isArray(errors.schedule) && (
                    <p className="error">{errors.schedule.message}</p>
                )}

                <button
                    type="button"
                    className="add"
                    onClick={() =>
                        append({ time: '09:00', title: '', duration: 30 })
                    }
                >
                    + Add session
                </button>
            </div>
        </>
    );
}

// ---------------------------------------------------------------------------
// Step 3 -- Speakers (conditional: type is conference or workshop)
// ---------------------------------------------------------------------------

function SpeakersStep() {
    const {
        register,
        formState: { errors }
    } = useComposedFormContext<FormValues>();

    const { fields, append, remove } = useFieldArray<FormValues>({
        name: 'speakers'
    });

    return (
        <>
            <h2>Speakers</h2>

            {fields.map((field, index) => (
                <div
                    key={field.id}
                    style={{
                        marginBottom: '1rem',
                        paddingBottom: '1rem',
                        borderBottom: '1px solid #e5e7eb'
                    }}
                >
                    <div className="field-row">
                        <input
                            {...register(`speakers.${index}.name`)}
                            placeholder="Name"
                        />
                        <input
                            {...register(`speakers.${index}.email`)}
                            placeholder="Email"
                        />
                        <button
                            type="button"
                            className="remove"
                            onClick={() => remove(index)}
                        >
                            X
                        </button>
                    </div>
                    <label style={{ marginBottom: '0.25rem' }}>
                        <input
                            {...register(`speakers.${index}.topic`)}
                            placeholder="Talk topic"
                        />
                    </label>
                    <label style={{ marginBottom: 0 }}>
                        <textarea
                            {...(register(`speakers.${index}.bio`) as never)}
                            placeholder="Short bio (optional, max 200 chars)"
                            rows={2}
                        />
                    </label>
                    {(errors.speakers as never)?.[index] && (
                        <p className="error">Please fill in all required speaker fields</p>
                    )}
                </div>
            ))}
            {errors.speakers && !Array.isArray(errors.speakers) && (
                <p className="error">{errors.speakers.message}</p>
            )}

            <button
                type="button"
                className="add"
                onClick={() =>
                    append({ name: '', email: '', topic: '', bio: '' })
                }
            >
                + Add speaker
            </button>
        </>
    );
}

// ---------------------------------------------------------------------------
// Step 4 -- Venue (conditional: format is in-person or hybrid)
// ---------------------------------------------------------------------------

function VenueStep() {
    const {
        register,
        formState: { errors }
    } = useComposedFormContext<FormValues>();

    const venueErrors = errors.venue as
        | Record<string, { message?: string }>
        | undefined;

    return (
        <>
            <h2>Venue Details</h2>

            <label>
                <span>Venue name</span>
                <input {...register('venue.name')} placeholder="e.g. Convention Center" />
                {venueErrors?.name && (
                    <p className="error">{venueErrors.name.message}</p>
                )}
            </label>

            <label>
                <span>Address</span>
                <input {...register('venue.address')} />
                {venueErrors?.address && (
                    <p className="error">{venueErrors.address.message}</p>
                )}
            </label>

            <label>
                <span>City</span>
                <input {...register('venue.city')} />
                {venueErrors?.city && (
                    <p className="error">{venueErrors.city.message}</p>
                )}
            </label>

            <label>
                <span>Notes (optional)</span>
                <textarea
                    {...(register('venue.notes') as never)}
                    placeholder="Parking, accessibility, etc."
                    rows={2}
                />
            </label>
        </>
    );
}

// ---------------------------------------------------------------------------
// Step 5 -- Ticketing (conditional: pricing is paid)
// ---------------------------------------------------------------------------

function TicketingStep() {
    const {
        register,
        formState: { errors }
    } = useComposedFormContext<FormValues>();

    const { fields, append, remove } = useFieldArray<FormValues>({
        name: 'sponsors'
    });

    const ticketingErrors = errors.ticketing as
        | Record<string, { message?: string }>
        | undefined;

    // Cross-field refine error lands on this path.
    const earlyBirdCrossError = (errors as Record<string, { message?: string }>)[
        'ticketing.earlyBirdPrice'
    ];

    return (
        <>
            <h2>Ticketing & Sponsors</h2>

            <label>
                <span>Regular price ($)</span>
                <input
                    type="number"
                    {...register('ticketing.regularPrice')}
                    min={1}
                />
                {ticketingErrors?.regularPrice && (
                    <p className="error">
                        {ticketingErrors.regularPrice.message}
                    </p>
                )}
            </label>

            <label>
                <span>Early bird price ($)</span>
                <input
                    type="number"
                    {...register('ticketing.earlyBirdPrice')}
                    min={0}
                />
                {(ticketingErrors?.earlyBirdPrice || earlyBirdCrossError) && (
                    <p className="error">
                        {ticketingErrors?.earlyBirdPrice?.message ??
                            earlyBirdCrossError?.message}
                    </p>
                )}
            </label>

            <label>
                <span>Early bird deadline</span>
                <input
                    type="date"
                    {...register('ticketing.earlyBirdDeadline')}
                />
                {ticketingErrors?.earlyBirdDeadline && (
                    <p className="error">
                        {ticketingErrors.earlyBirdDeadline.message}
                    </p>
                )}
            </label>

            <div style={{ marginTop: '1.5rem' }}>
                <span
                    style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        marginBottom: '0.5rem'
                    }}
                >
                    Sponsors
                </span>

                {fields.map((field, index) => (
                    <div className="field-row" key={field.id}>
                        <input
                            {...register(`sponsors.${index}.name`)}
                            placeholder="Sponsor"
                        />
                        <select {...register(`sponsors.${index}.tier`)}>
                            <option value="gold">Gold</option>
                            <option value="silver">Silver</option>
                            <option value="bronze">Bronze</option>
                        </select>
                        <input
                            type="number"
                            {...register(`sponsors.${index}.amount`)}
                            placeholder="$"
                            min={0}
                            style={{ maxWidth: '5rem' }}
                        />
                        <button
                            type="button"
                            className="remove"
                            onClick={() => remove(index)}
                        >
                            X
                        </button>
                    </div>
                ))}

                <button
                    type="button"
                    className="add"
                    onClick={() =>
                        append({ name: '', tier: 'silver', amount: 0 })
                    }
                >
                    + Add sponsor
                </button>
            </div>
        </>
    );
}

// ---------------------------------------------------------------------------
// Step 6 -- Notifications
// ---------------------------------------------------------------------------

function NotificationsStep() {
    const {
        formState: { errors }
    } = useComposedFormContext<FormValues>();

    const notifyErrors = errors.notify as
        | Record<string, { message?: string }>
        | undefined;

    return (
        <>
            <h2>Notifications</h2>

            <ToggleSwitch name="notify.onRegistration" label="New registration" />
            <ToggleSwitch name="notify.onCapacity" label="Capacity reached" />
            <ToggleSwitch name="notify.dailyDigest" label="Daily digest" />

            <label style={{ marginTop: '1rem' }}>
                <span>Channel</span>
                <Controller<FormValues>
                    name="notify.channel"
                    render={({ field }) => (
                        <div className="radio-group">
                            {CHANNELS.map((c) => (
                                <button
                                    key={c.value}
                                    type="button"
                                    className={`radio-card${field.value === c.value ? ' selected' : ''}`}
                                    onClick={() => field.onChange(c.value)}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    )}
                />
                {notifyErrors?.channel && (
                    <p className="error">{notifyErrors.channel.message}</p>
                )}
            </label>
        </>
    );
}

// ---------------------------------------------------------------------------
// Step 7 -- Review
// ---------------------------------------------------------------------------

function ReviewStep() {
    const { goToStep } = useComposedFormContext<FormValues>();
    const values = useWatch<FormValues>() as FormValues;

    const hasSpeakers =
        (values.type === 'conference' || values.type === 'workshop') &&
        values.speakers &&
        values.speakers.length > 0;
    const hasVenue =
        (values.format === 'in-person' || values.format === 'hybrid') &&
        values.venue;
    const hasTicketing = values.pricing === 'paid' && values.ticketing;

    return (
        <>
            <h2>Review & Submit</h2>
            <p className="review-hint">
                Check everything below. Click Edit to go back and change
                anything.
            </p>

            {/* Basics */}
            <div className="review-section">
                <div className="review-header">
                    <strong>Basics</strong>
                    <button
                        type="button"
                        className="link"
                        onClick={() => goToStep('basics')}
                    >
                        Edit
                    </button>
                </div>
                <div className="review-row">
                    <span>Name</span>
                    <span>{values.name}</span>
                </div>
                <div className="review-row">
                    <span>Slug</span>
                    <span>{values.slug}</span>
                </div>
                <div className="review-row">
                    <span>Type</span>
                    <span style={{ textTransform: 'capitalize' }}>
                        {values.type}
                    </span>
                </div>
                <div className="review-row">
                    <span>Format</span>
                    <span style={{ textTransform: 'capitalize' }}>
                        {values.format}
                    </span>
                </div>
                <div className="review-row">
                    <span>Capacity</span>
                    <span>{values.capacity}</span>
                </div>
                <div className="review-row">
                    <span>Pricing</span>
                    <span style={{ textTransform: 'capitalize' }}>
                        {values.pricing}
                    </span>
                </div>
            </div>

            {/* Schedule */}
            <div className="review-section">
                <div className="review-header">
                    <strong>Schedule</strong>
                    <button
                        type="button"
                        className="link"
                        onClick={() => goToStep('schedule')}
                    >
                        Edit
                    </button>
                </div>
                <div className="review-row">
                    <span>Dates</span>
                    <span>
                        {values.startDate} to {values.endDate}
                    </span>
                </div>
                <div className="review-row">
                    <span>Sessions</span>
                    <span>{values.schedule?.length ?? 0}</span>
                </div>
            </div>

            {/* Speakers (conditional) */}
            {hasSpeakers && (
                <div className="review-section">
                    <div className="review-header">
                        <strong>Speakers</strong>
                        <button
                            type="button"
                            className="link"
                            onClick={() => goToStep('speakers')}
                        >
                            Edit
                        </button>
                    </div>
                    {values.speakers!.map((s, i) => (
                        <div className="review-row" key={i}>
                            <span>{s.name}</span>
                            <span>{s.topic}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Venue (conditional) */}
            {hasVenue && (
                <div className="review-section">
                    <div className="review-header">
                        <strong>Venue</strong>
                        <button
                            type="button"
                            className="link"
                            onClick={() => goToStep('venue')}
                        >
                            Edit
                        </button>
                    </div>
                    <div className="review-row">
                        <span>Name</span>
                        <span>{values.venue!.name}</span>
                    </div>
                    <div className="review-row">
                        <span>Address</span>
                        <span>{values.venue!.address}</span>
                    </div>
                    <div className="review-row">
                        <span>City</span>
                        <span>{values.venue!.city}</span>
                    </div>
                </div>
            )}

            {/* Ticketing (conditional) */}
            {hasTicketing && (
                <div className="review-section">
                    <div className="review-header">
                        <strong>Ticketing</strong>
                        <button
                            type="button"
                            className="link"
                            onClick={() => goToStep('ticketing')}
                        >
                            Edit
                        </button>
                    </div>
                    <div className="review-row">
                        <span>Regular</span>
                        <span>${values.ticketing!.regularPrice}</span>
                    </div>
                    <div className="review-row">
                        <span>Early bird</span>
                        <span>${values.ticketing!.earlyBirdPrice}</span>
                    </div>
                    <div className="review-row">
                        <span>Deadline</span>
                        <span>{values.ticketing!.earlyBirdDeadline}</span>
                    </div>
                    {values.sponsors && values.sponsors.length > 0 && (
                        <div className="review-row">
                            <span>Sponsors</span>
                            <span>
                                {values.sponsors.map((s) => s.name).join(', ')}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Notifications */}
            <div className="review-section">
                <div className="review-header">
                    <strong>Notifications</strong>
                    <button
                        type="button"
                        className="link"
                        onClick={() => goToStep('notifications')}
                    >
                        Edit
                    </button>
                </div>
                <div className="review-row">
                    <span>Alerts</span>
                    <span>
                        {[
                            values.notify?.onRegistration && 'registration',
                            values.notify?.onCapacity && 'capacity',
                            values.notify?.dailyDigest && 'digest'
                        ]
                            .filter(Boolean)
                            .join(', ') || 'none'}
                    </span>
                </div>
                <div className="review-row">
                    <span>Channel</span>
                    <span style={{ textTransform: 'capitalize' }}>
                        {values.notify?.channel}
                    </span>
                </div>
            </div>
        </>
    );
}

// ---------------------------------------------------------------------------
// Watchers -- observe fields to toggle conditional steps
// ---------------------------------------------------------------------------

function ConditionalStepWatcher({
    onTypeChange,
    onFormatChange,
    onPricingChange
}: {
    onTypeChange: (v: string) => void;
    onFormatChange: (v: string) => void;
    onPricingChange: (v: string) => void;
}) {
    const { watch } = useComposedFormContext<FormValues>();

    useEffect(() => {
        const sub = watch((values) => {
            onTypeChange(values.type ?? '');
            onFormatChange(values.format ?? '');
            onPricingChange(values.pricing ?? '');
        });
        return () => sub.unsubscribe();
    }, [watch, onTypeChange, onFormatChange, onPricingChange]);

    return null;
}

// ---------------------------------------------------------------------------
// Guide Sidebar -- shows conditional steps, active features, and tips
// ---------------------------------------------------------------------------

const STEP_TIPS: Record<string, string> = {
    basics:
        'Your choices here shape the wizard. Try changing Event type or Format and watch the step indicator update.',
    schedule:
        'Add schedule items to see useFieldArray in action. Total duration is computed reactively via useWatch.',
    speakers:
        'This step only appears for Conference or Workshop events. Change the event type on step 1 to hide it.',
    venue:
        'This step only appears for In-Person or Hybrid formats. Switch to Virtual on step 1 to hide it.',
    ticketing:
        'This step only appears when Pricing is set to Paid. Switch to Free on step 1 to hide it.',
    notifications:
        'Toggle switches use useController for custom boolean inputs. The channel selector uses Controller.',
    review:
        'All form values are read reactively with useWatch. Click Edit links to jump to any step with goToStep().'
};

function GuideSidebar({
    eventType,
    format,
    pricing
}: {
    eventType: string;
    format: string;
    pricing: string;
}) {
    const { currentStepName } = useStep();

    const showSpeakers =
        eventType === 'conference' || eventType === 'workshop';
    const showVenue = format === 'in-person' || format === 'hybrid';
    const showTicketing = pricing === 'paid';

    const conditionalSteps = [
        {
            name: 'Speakers',
            active: showSpeakers,
            trigger: 'Event type = Conference or Workshop',
            current: eventType
                ? `Type: ${eventType}`
                : 'Not yet selected'
        },
        {
            name: 'Venue',
            active: showVenue,
            trigger: 'Format = In-Person or Hybrid',
            current: format
                ? `Format: ${format}`
                : 'Not yet selected'
        },
        {
            name: 'Ticketing',
            active: showTicketing,
            trigger: 'Pricing = Paid',
            current: pricing
                ? `Pricing: ${pricing}`
                : 'Not yet selected'
        }
    ];

    const features = [
        {
            label: 'Auto-derived slug from event name',
            highlight: currentStepName === 'basics'
        },
        {
            label: 'Character counters via useFormContext',
            highlight: currentStepName === 'basics'
        },
        {
            label: 'Dynamic field arrays (schedule, speakers, sponsors)',
            highlight:
                currentStepName === 'schedule' ||
                currentStepName === 'speakers' ||
                currentStepName === 'ticketing'
        },
        {
            label: 'Reactive total duration via useWatch',
            highlight: currentStepName === 'schedule'
        },
        {
            label: 'Custom toggle switches via useController',
            highlight: currentStepName === 'notifications'
        },
        {
            label: 'Cross-field validation (dates, pricing)',
            highlight:
                currentStepName === 'schedule' ||
                currentStepName === 'ticketing'
        },
        {
            label: 'Step-level onSubmitStep callbacks',
            highlight: true
        },
        {
            label: 'Dirty field indicators on step dots',
            highlight: true
        }
    ];

    return (
        <aside className="guide">
            <h3>Conditional Steps</h3>
            <div className="guide-section">
                {conditionalSteps.map((step) => (
                    <div
                        key={step.name}
                        className={`guide-card ${step.active ? 'active' : 'inactive'}`}
                    >
                        <div className="guide-card-title">
                            {step.name}{' '}
                            <span
                                className={`guide-tag ${step.active ? 'on' : 'off'}`}
                            >
                                {step.active ? 'visible' : 'hidden'}
                            </span>
                        </div>
                        <div className="guide-card-desc">
                            {step.trigger}
                            <br />
                            {step.current}
                        </div>
                    </div>
                ))}
            </div>

            <h3>Active Features</h3>
            <ul className="guide-feature-list">
                {features.map((f) => (
                    <li
                        key={f.label}
                        className={f.highlight ? 'highlight' : ''}
                    >
                        {f.label}
                    </li>
                ))}
            </ul>

            <h3>Try This</h3>
            <div className="guide-tip">
                {STEP_TIPS[currentStepName] ?? 'Navigate through the wizard to see different features.'}
            </div>
        </aside>
    );
}

// ---------------------------------------------------------------------------
// Root App
// ---------------------------------------------------------------------------

function App() {
    const [submitted, setSubmitted] = useState<FormValues | null>(null);
    const [eventType, setEventType] = useState('');
    const [format, setFormat] = useState('');
    const [pricing, setPricing] = useState('');

    const handleTypeChange = useCallback((v: string) => setEventType(v), []);
    const handleFormatChange = useCallback((v: string) => setFormat(v), []);
    const handlePricingChange = useCallback((v: string) => setPricing(v), []);

    const showSpeakers = eventType === 'conference' || eventType === 'workshop';
    const showVenue = format === 'in-person' || format === 'hybrid';
    const showTicketing = pricing === 'paid';

    const onSubmit: SubmitHandler<FormValues> = (data) => {
        setSubmitted(data);
    };

    if (submitted) {
        return (
            <>
                <h2>Event Created!</h2>
                <pre>{JSON.stringify(submitted, null, 2)}</pre>
                <button onClick={() => setSubmitted(null)}>Start over</button>
            </>
        );
    }

    return (
        <ComposedForm
            schema={schema}
            defaultValues={{
                pricing: 'free' as const,
                notify: {
                    onRegistration: true,
                    onCapacity: false,
                    dailyDigest: false,
                    channel: 'email' as const
                }
            }}
            onSubmit={onSubmit}
            onSubmitStep={(stepName, values) => {
                console.log(`[onSubmitStep] ${stepName}:`, values);
            }}
        >
            <ConditionalStepWatcher
                onTypeChange={handleTypeChange}
                onFormatChange={handleFormatChange}
                onPricingChange={handlePricingChange}
            />
            <div className="app-layout">
                <div>
                    <StepIndicator />

                    <Step name="basics">
                        <BasicsStep />
                    </Step>

                    <Step name="schedule">
                        <ScheduleStep />
                    </Step>

                    <Step name="speakers" enabled={showSpeakers}>
                        <SpeakersStep />
                    </Step>

                    <Step name="venue" enabled={showVenue}>
                        <VenueStep />
                    </Step>

                    <Step name="ticketing" enabled={showTicketing}>
                        <TicketingStep />
                    </Step>

                    <Step name="notifications">
                        <NotificationsStep />
                    </Step>

                    <Step name="review">
                        <ReviewStep />
                    </Step>

                    <NavBar />
                </div>

                <GuideSidebar
                    eventType={eventType}
                    format={format}
                    pricing={pricing}
                />
            </div>
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
