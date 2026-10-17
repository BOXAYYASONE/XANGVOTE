import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import bcrypt from 'bcrypt';
import {
  createPool,
  databaseEnvironmentVariables,
  getMissingDatabaseVariables
} from '../src/config/db.js';
import { initializeDatabase } from '../src/config/initializeDatabase.js';

class MockPool {
  queries = [];
  executions = [];
  admins = [];
  settings = new Map();
  transactions = [];

  async query(sql, values = []) {
    this.queries.push({ sql, values });
    if (sql.startsWith('INSERT IGNORE INTO settings')) {
      this.settings.set(values[0], values[1]);
    }
    return [{ affectedRows: 1 }, []];
  }

  async getConnection() {
    return {
      beginTransaction: async () => this.transactions.push('begin'),
      execute: async (sql, values) => {
        this.executions.push({ sql, values });
        if (sql.startsWith('SELECT id FROM admins')) {
          return [this.admins.filter((admin) => admin.username === values[0]), []];
        }
        if (sql.startsWith('INSERT INTO admins')) {
          this.admins.push({ username: values[0], password_hash: values[1] });
          return [{ insertId: this.admins.length }, []];
        }
        throw new Error(`Unexpected SQL in test: ${sql}`);
      },
      commit: async () => this.transactions.push('commit'),
      rollback: async () => this.transactions.push('rollback'),
      release: () => this.transactions.push('release')
    };
  }
}

const adminEnvironment = {
  ADMIN_USERNAME: 'test-admin',
  ADMIN_PASSWORD: 'test-only-password'
};

describe('MySQL database initialization', () => {
  it('uses idempotent utf8mb4 InnoDB schema and seeds a bcrypt admin hash', async () => {
    const pool = new MockPool();
    await initializeDatabase(pool, adminEnvironment);

    const schema = await readFile(
      new URL('../src/config/schema.sql', import.meta.url),
      'utf8'
    );
    const createStatements = pool.queries.filter(({ sql }) =>
      sql.startsWith('CREATE TABLE IF NOT EXISTS')
    );

    assert.equal(createStatements.length, 4);
    assert.match(schema, /ENGINE=InnoDB/);
    assert.match(schema, /CHARACTER SET=utf8mb4/);
    assert.match(schema, /UNIQUE KEY uq_votes_singer_voter \(singer_id, voter_token\)/);
    assert.match(schema, /ON DELETE CASCADE/);
    assert.doesNotMatch(schema, /vote_count|AUTOINCREMENT|strftime/i);
    assert.equal(pool.settings.get('is_voting_open'), 'false');
    assert.equal(pool.admins.length, 1);
    assert.equal(pool.admins[0].username, adminEnvironment.ADMIN_USERNAME);
    assert.equal(
      await bcrypt.compare(adminEnvironment.ADMIN_PASSWORD, pool.admins[0].password_hash),
      true
    );
    assert.equal(
      pool.executions.every(({ sql, values }) => sql.includes('?') && Array.isArray(values)),
      true
    );
    assert.equal(
      pool.queries.some(({ sql }) => sql.includes(adminEnvironment.ADMIN_PASSWORD)),
      false
    );
    assert.deepEqual(pool.transactions, ['begin', 'commit', 'release']);
  });

  it('reports missing admin environment variables before changing the database', async () => {
    const pool = new MockPool();

    await assert.rejects(
      initializeDatabase(pool, {}),
      /Missing required environment variables: ADMIN_USERNAME, ADMIN_PASSWORD/
    );
    assert.equal(pool.queries.length, 0);
    assert.equal(pool.admins.length, 0);
  });

  it('can be run again without duplicating the seeded admin or settings', async () => {
    const pool = new MockPool();

    await initializeDatabase(pool, adminEnvironment);
    await initializeDatabase(pool, adminEnvironment);

    assert.equal(pool.admins.length, 1);
    assert.equal(pool.settings.size, 1);
    assert.equal(
      pool.queries.filter(({ sql }) => sql.startsWith('CREATE TABLE IF NOT EXISTS')).length,
      8
    );
  });

  it('reports all missing database variables and accepts a blank MySQL password', () => {
    assert.deepEqual(getMissingDatabaseVariables({}), databaseEnvironmentVariables);
    assert.deepEqual(
      getMissingDatabaseVariables({
        DB_HOST: '127.0.0.1',
        DB_PORT: '3306',
        DB_USER: 'root',
        DB_PASSWORD: '',
        DB_NAME: 'xang_vote'
      }),
      []
    );
    assert.throws(
      () => createPool({}),
      /Missing required environment variables: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME/
    );
    assert.throws(
      () =>
        createPool({
          DB_HOST: '127.0.0.1',
          DB_PORT: '3306abc',
          DB_USER: 'root',
          DB_PASSWORD: '',
          DB_NAME: 'xang_vote'
        }),
      /DB_PORT must be an integer/
    );
  });
});
