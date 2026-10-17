export async function existsForVoter(pool, singerId, voterToken) {
  const [rows] = await pool.execute(
    'SELECT id FROM votes WHERE singer_id = ? AND voter_token = ? LIMIT 1',
    [singerId, voterToken]
  );
  return rows.length > 0;
}

export async function createVote(pool, singerId, voterToken) {
  await pool.execute('INSERT INTO votes (singer_id, voter_token) VALUES (?, ?)', [
    singerId,
    voterToken
  ]);
}
