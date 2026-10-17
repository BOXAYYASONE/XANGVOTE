export async function findAllWithVoteCounts(pool) {
  const [rows] = await pool.execute(
    `SELECT singers.id, singers.name, singers.image_url, COUNT(votes.id) AS vote_count
     FROM singers
     LEFT JOIN votes ON votes.singer_id = singers.id
     GROUP BY singers.id, singers.name, singers.image_url
     ORDER BY singers.id`
  );
  return rows;
}

export async function existsById(pool, singerId) {
  const [rows] = await pool.execute('SELECT id FROM singers WHERE id = ? LIMIT 1', [
    singerId
  ]);
  return rows.length > 0;
}

export async function findAllResults(pool) {
  const [rows] = await pool.execute(
    `SELECT singers.id, singers.name, singers.image_url, singers.created_at,
            COUNT(votes.id) AS vote_count
     FROM singers
     LEFT JOIN votes ON votes.singer_id = singers.id
     GROUP BY singers.id, singers.name, singers.image_url, singers.created_at
     ORDER BY vote_count DESC, singers.name ASC`
  );
  return rows.map((row) => ({ ...row, vote_count: Number(row.vote_count) }));
}

export async function findById(pool, singerId) {
  const [rows] = await pool.execute(
    'SELECT id, name, image_url FROM singers WHERE id = ? LIMIT 1',
    [singerId]
  );
  return rows[0] || null;
}

export async function create(pool, name, imageUrl) {
  const [result] = await pool.execute(
    'INSERT INTO singers (name, image_url) VALUES (?, ?)',
    [name, imageUrl]
  );
  return result.insertId;
}

export async function update(pool, singerId, name, imageUrl) {
  const [result] = await pool.execute(
    'UPDATE singers SET name = ?, image_url = ? WHERE id = ?',
    [name, imageUrl, singerId]
  );
  return result.affectedRows > 0;
}

export async function deleteById(pool, singerId) {
  const [result] = await pool.execute('DELETE FROM singers WHERE id = ?', [singerId]);
  return result.affectedRows > 0;
}
