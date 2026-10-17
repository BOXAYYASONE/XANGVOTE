export async function findValueByKey(pool, settingKey) {
  const [rows] = await pool.execute(
    'SELECT value FROM settings WHERE setting_key = ? LIMIT 1',
    [settingKey]
  );
  return rows[0]?.value ?? null;
}

export async function setValueByKey(pool, settingKey, value) {
  await pool.execute(
    `INSERT INTO settings (setting_key, value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value)`,
    [settingKey, value]
  );
}
