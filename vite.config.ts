import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves project sites from /<repo>/, not /. The Pages workflow
// sets GITHUB_PAGES_BASE; every other build target (dev server, Docker/nginx)
// is served from root and leaves it unset.
const base = process.env.GITHUB_PAGES_BASE || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor'
          if (id.includes('/src/corpus/ajp/')) return 'corpus-ajp'
          return undefined
        },
      },
    },
  },
  // Vitest config lives here, but this project runs Vite 8 (rolldown) while
  // Vitest bundles its own nested Vite — so neither `vitest/config`'s
  // `defineConfig` (plugin-type clash) nor the `/// <reference>` augmentation
  // types the `test` key against top-level Vite. Suppress the one known-invalid
  // property; it is valid at runtime and consumed by `vitest run`.
  // @ts-expect-error `test` is not on Vite 8's config type (dual-Vite toolchain).
  test: {
    // Boot the active domain before any test file runs (binds the retrieval graph).
    setupFiles: ['./src/test-setup.ts'],
  },
})
