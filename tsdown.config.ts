import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    external: [
        'react',
        'react-dom',
        'react-hook-form',
        '@hookform/resolvers',
        'zod'
    ],
    treeshake: true,
    sourcemap: false
});
