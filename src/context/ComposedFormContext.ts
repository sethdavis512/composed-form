import { createContext } from 'react';
import type { FieldValues } from 'react-hook-form';
import type { ComposedFormContextValue } from '../types.ts';

export const ComposedFormContext =
    createContext<ComposedFormContextValue<FieldValues> | null>(null);
