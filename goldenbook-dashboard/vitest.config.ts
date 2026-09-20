// Minimal vitest setup for the dashboard's pure-function unit tests.
//
// The tests under components/**/__tests__ were written for vitest but there
// was no runner or config, so they had never actually executed — the `@/`
// alias that every component uses could not resolve. This wires that alias to
// the same root the tsconfig `paths` entry points at.
//
// Scope is deliberately narrow: these are unit tests over exported pure
// helpers, so no jsdom environment and no React plugin are needed. Add them
// when the first component-rendering test arrives.

import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
  },
})
