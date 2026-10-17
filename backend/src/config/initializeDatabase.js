import { readFile } from 'node:fs/promises';
import bcrypt from 'bcrypt';

const schemaUrl = new URL('./schema.sql', import.meta.url);

export async function initializeDatabase(pool, environment = process.env) {
  const username = environment.ADMIN_USERNAME?.trim();
  const password = environment.ADMIN_PASSWORD;
  const missingAdminVariables = [];
  if (!username) {
    missingAdminVariables.push('ADMIN_USERNAME');
  }
  if (!password) {
    missingAdminVariables.push('ADMIN_PASSWORD');
  }
  if (missingAdminVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingAdminVariables.join(', ')}`
    );
  }

  const schema = await readFile(schemaUrl, 'utf8');
  for (const statement of schema.split(';').map((part) => part.trim()).filter(Boolean)) {
    await pool.query(statement);
  }

  await pool.query(
    'INSERT IGNORE INTO settings (setting_key, value) VALUES (?, ?)',
    ['is_voting_open', 'false']
  );

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [admins] = await connection.execute(
      'SELECT id FROM admins WHERE username = ? LIMIT 1',
      [username]
    );

    if (admins.length === 0) {
      const passwordHash = await bcrypt.hash(password, 12);
      await connection.execute(
        'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
        [username, passwordHash]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
