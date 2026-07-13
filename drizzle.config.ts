import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  dbCredentials: {
    url: './knowledge/knowledge.db',
  },
  schema: './src/db/schema.ts',
  out: './knowledge/migrations',
});
