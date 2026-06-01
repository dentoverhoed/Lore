import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  // The CLI is the only entry; keep deps external (installed at runtime).
  banner: { js: '#!/usr/bin/env node' },
});
