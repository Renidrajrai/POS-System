import knex from 'knex'
import pg from 'pg'

pg.types.setTypeParser(1082, val => val)

const db = knex({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'mauspot',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Renid9818',
  },
  pool: { min: 2, max: 10 },
})

export default db
