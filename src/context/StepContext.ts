import { createContext } from 'react';
import type { StepContextValue } from '../types.ts';

export const StepContext = createContext<StepContextValue | null>(null);
