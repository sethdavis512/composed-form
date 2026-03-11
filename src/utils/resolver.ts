import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodSchema } from 'zod';
import type { Resolver, FieldValues } from 'react-hook-form';

/**
 * Creates an RHF-compatible resolver from a Zod schema.
 * This is a thin wrapper around `@hookform/resolvers/zod` so consumers
 * only need to install `zod` and don't need to import from resolvers directly.
 */
export function createZodResolver<TValues extends FieldValues>(
    schema: ZodSchema<TValues>
): Resolver<TValues> {
    return zodResolver(schema) as Resolver<TValues>;
}
