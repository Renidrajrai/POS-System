import knex from 'knex'
import pg from 'pg'

pg.types.setTypeParser(1082, val => val)

const db = knex({
  client: 'pg',
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'mauspot',
    user: 'postgres',
    password: 'Renid9818',
  },
  pool: { min: 2, max: 10 },
})

export default db
