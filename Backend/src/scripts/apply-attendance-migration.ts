import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { env } from '../config/env.js';

if (env.NODE_ENV !== 'development') {
  throw new Error('The attendance migration helper only runs when NODE_ENV=development.');
}
if (!env.SUPABASE_DB_URL) throw new Error('SUPABASE_DB_URL must be set in Backend/.env.');

const migrationUrl = new URL('../../../supabase/migrations/0006_attendance.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');
const client = new Client({
  connectionString: env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query('begin');
  const { rows } = await client.query(
    "select to_regclass('public.attendance_records') as table_name",
  );
  if (!rows[0]?.table_name) await client.query(sql);

  const history = await client.query(
    "select to_regclass('supabase_migrations.schema_migrations') as table_name",
  );
  if (history.rows[0]?.table_name) {
    await client.query(
      `insert into supabase_migrations.schema_migrations (version, name, statements)
       values ($1, $2, $3) on conflict (version) do nothing`,
      ['0006', 'attendance', [sql]],
    );
  }
  await client.query('commit');
  console.log('Attendance table and access policies are ready.');
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
