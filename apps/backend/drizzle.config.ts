import type { Config } from 'drizzle-kit';
import { config } from './src/config';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: config.databaseUrl,
  },
} satisfies Config;
