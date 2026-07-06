const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { DATABASE_URL, ROOT } = require('./api.config');

const pool = new Pool({ connectionString: DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const files = fs.readdirSync(ROOT)
      .filter((file) => /^migration\.\d+_.+\.sql$/.test(file))
      .sort();

    await client.query(`
      CREATE TABLE IF NOT EXISTS migration_history (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const applied = await client.query('SELECT name FROM migration_history WHERE name = $1', [file]);
      if (applied.rowCount) continue;

      const sql = fs.readFileSync(path.join(ROOT, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO migration_history (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } catch (error) {
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
