import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Separate from vite.config.js so the dev server config (proxy, host) stays out
// of the test runner. jsdom gives component tests a DOM; setup wires in the
// jest-dom matchers and resets mocks between tests.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // React 19 only ships `act` in its *development* build, and
    // @testing-library/react's act-compat reads `require('react').act`. When the
    // runner inherits NODE_ENV=production (some CI images / shells export it),
    // react's CJS entry loads react.production.js — `React.act` is undefined and
    // act-compat falls through to the removed react-dom/test-utils stub, throwing
    // "React.act is not a function". Force the development build for tests so act
    // resolves regardless of the inherited NODE_ENV. (TRE-34)
    env: { NODE_ENV: 'development' },
  },
});
