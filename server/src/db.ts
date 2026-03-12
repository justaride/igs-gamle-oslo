import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://igs:igs_dev_2024@localhost:5432/igs',
})

export const query = (text: string, params?: unknown[]) => pool.query(text, params)

export default pool
