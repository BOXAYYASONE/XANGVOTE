import { createApp } from './app.js';
import { createPool } from './config/db.js';
import { initializeDatabase } from './config/initializeDatabase.js';

const pool = createPool();
await initializeDatabase(pool);
const app = createApp(pool);

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => {
  console.log(`XANG_VOTE backend listening on port ${port}.`);
});

function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
