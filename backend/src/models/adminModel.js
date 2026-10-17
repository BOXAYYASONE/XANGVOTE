export async function findByUsername(pool, username) {
  const [rows] = await pool.execute(
    'SELECT id, username, password_hash FROM admins WHERE username = ? LIMIT 1',
    [username]
  );
  return rows[0] || null;
}
