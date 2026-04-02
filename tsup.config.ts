import { defineConfig } from 'tsup';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

export default defineConfig({
    entryPoints: ['src/index.ts'],
    format: ['esm'],
    dts: false,
    outDir: 'dist',
    clean: true,
    banner: {
        js: '#!/usr/bin/env node\n',
    },
    define: {
        __VERSION__: JSON.stringify(pkg.version),
    },
});
