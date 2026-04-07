import { readdir, readFile } from 'node:fs/promises'
import pool from './db.js'

const MIGRATIONS_DIR = new URL('../migrations/', import.meta.url)

export async function runMigrations() {
  const client = await pool.connect()

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    const migrationFiles = (await readdir(MIGRATIONS_DIR))
      .filter((name) => name.endsWith('.sql'))
      .sort()

    const appliedResult = await client.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations'
    )
    const applied = new Set(appliedResult.rows.map((row) => row.filename))

    for (const filename of migrationFiles) {
      if (applied.has(filename)) {
        continue
      }

      const sql = await readFile(new URL(filename, MIGRATIONS_DIR), 'utf-8')

      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query(
          'INSERT INTO schema_migrations (filename, applied_at) VALUES ($1, NOW())',
          [filename]
        )
        await client.query('COMMIT')
        console.log(`Applied migration ${filename}`)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    client.release()
  }
}
