import { useContext } from 'react';
import { useFormContext } from 'react-hook-form';
import type {
    FieldPath,
    FieldValues,
    RegisterOptions,
    UseFormRegisterReturn,
    UseFormReturn
} from 'react-hook-form';
import { ComposedFormContext } from '../context/ComposedFormContext.ts';
import { StepContext } from '../context/StepContext.ts';
import type { ComposedFormContextValue } from '../types.ts';

/**
 * Returns the full `react-hook-form` context plus composed-form wizard actions.
 *
 * The `register` function is enhanced: it automatically records the field name
 * in the enclosing `<Step>`'s `fieldRegistry` so the wizard knows which fields
 * to validate when advancing.
 *
 * Use this hook **inside** a `<ComposedForm>` tree (and optionally inside a
 * `<Step>`).
 */
export function useComposedFormContext<
    TValues extends FieldValues = FieldValues
>(): Omit<
    ComposedFormContextValue<TValues>,
    '_registerStep' | '_unregisterStep' | '_updateStepEnabled'
> &
    Omit<UseFormReturn<TValues>, 'register'> & {
        register: <TName extends FieldPath<TValues>>(
            name: TName,
            options?: RegisterOptions<TValues, TName>
        ) => UseFormRegisterReturn<TName>;
    } {
    const wizard = useContext(
        ComposedFormContext
    ) as ComposedFormContextValue<TValues> | null;
    const step = useContext(StepContext);
    const rhf = useFormContext<TValues>();

    if (!wizard) {
        throw new Error(
            'useComposedFormContext must be used inside a <ComposedForm>.'
        );
    }

    // Step-aware register: tracks the field name in the enclosing step's registry
    // and removes it when the field unmounts by wrapping RHF's ref callback.
    const register = <TName extends FieldPath<TValues>>(
        name: TName,
        options?: RegisterOptions<TValues, TName>
    ): UseFormRegisterReturn<TName> => {
        const rhfReg = rhf.register(name, options);
        if (!step) return rhfReg;
        return {
            ...rhfReg,
            ref(el: Parameters<typeof rhfReg.ref>[0]) {
                if (el != null) {
                    step.fieldRegistry.current.add(name);
                } else {
                    step.fieldRegistry.current.delete(name);
                }
                rhfReg.ref(el);
            }
        };
    };

    const {
        _registerStep: _r,
        _unregisterStep: _u,
        _updateStepEnabled: _e,
        ...publicWizard
    } = wizard;

    return {
        ...publicWizard,
        ...rhf,
        register
    };
}
