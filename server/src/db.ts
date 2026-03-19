import pg from 'pg'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('Missing required environment variable: DATABASE_URL')
}

const pool = new pg.Pool({
  connectionString,
})

export const query = (text: string, params?: unknown[]) => pool.query(text, params)

export default pool
