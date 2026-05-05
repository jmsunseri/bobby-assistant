import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./tests/register_mocks.js', './tests/setup.js'],
    environment: 'node',
  },
});