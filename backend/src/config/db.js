import mysql from 'mysql2/promise';

export const databaseEnvironmentVariables = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME'
];

export function getMissingDatabaseVariables(environment = process.env) {
  return databaseEnvironmentVariables.filter(
    (name) =>
      environment[name] === undefined ||
      (name !== 'DB_PASSWORD' && environment[name].trim() === '')
  );
}

export function createPool(environment = process.env) {
  const missingVariables = getMissingDatabaseVariables(environment);
  if (missingVariables.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}`);
  }

  const port = Number(environment.DB_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be an integer between 1 and 65535.');
  }

  return mysql.createPool({
    host: environment.DB_HOST,
    port,
    user: environment.DB_USER,
    password: environment.DB_PASSWORD,
    database: environment.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
  });
}
