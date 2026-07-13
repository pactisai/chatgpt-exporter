import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.js', '**/*.spec.js'],
    coverage: { provider: 'v8', reporter: ['text', 'json', 'html'], include: ['core/**', 'server/**', 'mcp/**'] },
  },
});
