import { createPool } from './db.js';
import { initializeDatabase } from './initializeDatabase.js';

let pool;
try {
  pool = createPool();
  await initializeDatabase(pool);
  console.log('Database schema initialized and admin is ready.');
} catch (error) {
  console.error(`Database initialization failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (pool) {
    await pool.end();
  }
}
