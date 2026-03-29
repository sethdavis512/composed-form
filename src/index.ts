// Components
export { ComposedForm } from './ComposedForm.tsx';
export { Step } from './Step.tsx';

// Hooks
export { useComposedFormContext } from './hooks/useComposedFormContext.ts';

// Types
export type {
    ComposedFormContextValue,
    ComposedFormProps,
    StepContextValue,
    StepProps,
    StepRegistration
} from './types.ts';

// Re-export commonly used react-hook-form utilities so consumers don't need a
// separate import for the basics.
export {
    Controller,
    useController,
    useFieldArray,
    useFormState,
    useWatch
} from 'react-hook-form';
export type {
    ControllerProps,
    ControllerRenderProps,
    FieldArrayWithId,
    FieldErrors,
    FieldValues,
    RegisterOptions,
    SubmitHandler,
    UseControllerProps,
    UseControllerReturn,
    UseFieldArrayReturn
} from 'react-hook-form';
