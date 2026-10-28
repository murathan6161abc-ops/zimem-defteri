import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: root }],
  },
  test: {
    include: ['lib/**/*.test.ts', 'store/**/*.test.ts'],
    // Seri ve tarih hesapları yerel takvim gününe bağlı: testler Türkiye saatiyle koşar.
    env: { TZ: 'Europe/Istanbul' },
  },
});
