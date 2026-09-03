/**
 * Applies every file in supabase/migrations in order.
 * Idempotent: every statement uses `if not exists` / `on conflict`, so running
 * it against an existing database is safe.
 *
 *   npm run db:migrate
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env.local first.');
    process.exit(1);
  }

  const dir = join(process.cwd(), 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

  try {
    for (const file of files) {
      process.stdout.write(`  ${file} … `);
      await sql.unsafe(readFileSync(join(dir, file), 'utf8'));
      console.log('ok');
    }
    const rows = await sql<{ count: string }[]>`select count(*)::text from object_type`;
    console.log(`\nSchema applied. ${rows[0]!.count} object types in the vocabulary.`);
  } catch (e) {
    console.error('\nMigration failed:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

void main();
