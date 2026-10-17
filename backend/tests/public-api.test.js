import assert from 'node:assert/strict';
import { once } from 'node:events';
import { afterEach, describe, it } from 'node:test';
import { createApp } from '../src/app.js';

class MockPool {
  singers = [{ id: 1, name: 'Test Singer', image_url: '/uploads/test.webp' }];
  votes = [];
  isVotingOpen = true;

  async execute(sql, values = []) {
    if (sql.startsWith('SELECT singers.id')) {
      return [
        this.singers.map((singer) => ({
          ...singer,
          vote_count: this.votes.filter((vote) => vote.singer_id === singer.id).length
        })),
        []
      ];
    }
    if (sql.startsWith('SELECT value FROM settings')) {
      return [[{ value: this.isVotingOpen ? 'true' : 'false' }], []];
    }
    if (sql.startsWith('SELECT id FROM singers')) {
      return [this.singers.filter((singer) => singer.id === values[0]), []];
    }
    if (sql.startsWith('SELECT id FROM votes')) {
      return [
        this.votes
          .filter((vote) => vote.singer_id === values[0] && vote.voter_token === values[1])
          .map((vote) => ({ id: vote.id })),
        []
      ];
    }
    if (sql.startsWith('INSERT INTO votes')) {
      if (
        this.votes.some(
          (vote) => vote.singer_id === values[0] && vote.voter_token === values[1]
        )
      ) {
        const error = new Error('Duplicate vote');
        error.code = 'ER_DUP_ENTRY';
        throw error;
      }
      this.votes.push({
        id: this.votes.length + 1,
        singer_id: values[0],
        voter_token: values[1]
      });
      return [{ affectedRows: 1 }, []];
    }
    throw new Error('Unexpected SQL');
  }
}

const servers = [];

async function requestWithApp(pool, callback) {
  const server = createApp(pool, 'http://localhost:5173').listen(0, '127.0.0.1');
  servers.push(server);
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return callback((path, options = {}) =>
    fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { Connection: 'close', ...options.headers }
    })
  );
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) => {
        server.closeAllConnections();
        return new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        });
      }
    )
  );
});

describe('public API', () => {
  it('returns singers with vote counts and voting status as a boolean', async () => {
    const pool = new MockPool();
    pool.votes.push({ id: 1, singer_id: 1, voter_token: 'existing-voter' });

    await requestWithApp(pool, async (request) => {
      const singersResponse = await request('/api/singers');
      assert.equal(singersResponse.status, 200);
      assert.deepEqual(await singersResponse.json(), [
        { id: 1, name: 'Test Singer', image_url: '/uploads/test.webp', vote_count: 1 }
      ]);

      const statusResponse = await request('/api/settings/voting');
      assert.equal(statusResponse.status, 200);
      assert.deepEqual(await statusResponse.json(), { is_voting_open: true });

      pool.isVotingOpen = false;
      const closedResponse = await request('/api/settings/voting');
      assert.deepEqual(await closedResponse.json(), { is_voting_open: false });
    });
  });

  it('records a first vote and sets a UUID httpOnly voter cookie', async () => {
    const pool = new MockPool();

    await requestWithApp(pool, async (request) => {
      const response = await request('/api/singers/1/vote', { method: 'POST' });

      assert.equal(response.status, 201);
      assert.deepEqual(await response.json(), { message: 'Vote recorded successfully' });
      assert.equal(pool.votes.length, 1);
      const cookie = response.headers.get('set-cookie');
      assert.match(cookie, /voter_token=[0-9a-f-]{36}/i);
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /SameSite=Lax/i);
    });
  });

  it('rejects a repeat vote with 409 for the same voter cookie', async () => {
    const pool = new MockPool();

    await requestWithApp(pool, async (request) => {
      const firstResponse = await request('/api/singers/1/vote', { method: 'POST' });
      const cookie = firstResponse.headers.get('set-cookie').split(';', 1)[0];
      const duplicateResponse = await request('/api/singers/1/vote', {
        method: 'POST',
        headers: { Cookie: cookie }
      });

      assert.equal(duplicateResponse.status, 409);
      assert.deepEqual(await duplicateResponse.json(), {
        error: 'You have already voted for this singer'
      });
      assert.equal(pool.votes.length, 1);
    });
  });

  it('rejects votes while voting is closed without recording a vote', async () => {
    const pool = new MockPool();
    pool.isVotingOpen = false;

    await requestWithApp(pool, async (request) => {
      const response = await request('/api/singers/1/vote', { method: 'POST' });

      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: 'Voting is currently closed' });
      assert.equal(pool.votes.length, 0);
    });
  });

  it('returns 404 when the requested singer does not exist', async () => {
    const pool = new MockPool();

    await requestWithApp(pool, async (request) => {
      const response = await request('/api/singers/99/vote', { method: 'POST' });

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Singer not found' });
      assert.equal(pool.votes.length, 0);
    });
  });

  it('returns consistent JSON errors for malformed IDs and internal failures', async () => {
    const pool = new MockPool();

    await requestWithApp(pool, async (request) => {
      const invalidIdResponse = await request('/api/singers/not-an-id/vote', {
        method: 'POST'
      });
      assert.equal(invalidIdResponse.status, 400);
      assert.deepEqual(await invalidIdResponse.json(), {
        error: 'Singer id must be a positive integer'
      });
    });

    const failingPool = new MockPool();
    failingPool.execute = async () => {
      throw new Error('database details must not leak');
    };

    await requestWithApp(failingPool, async (request) => {
      const response = await request('/api/singers');

      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: 'Internal server error' });
    });
  });

  it('limits vote requests to ten per minute per IP', async () => {
    const pool = new MockPool();

    await requestWithApp(pool, async (request) => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const response = await request('/api/singers/1/vote', { method: 'POST' });
        assert.equal(response.status, 201);
      }

      const limitedResponse = await request('/api/singers/1/vote', { method: 'POST' });
      assert.equal(limitedResponse.status, 429);
      assert.deepEqual(await limitedResponse.json(), {
        error: 'Too many vote attempts. Please try again later.'
      });
      assert.equal(pool.votes.length, 10);
    });
  });

  it('uses a consistent JSON error shape for unknown routes', async () => {
    const pool = new MockPool();

    await requestWithApp(pool, async (request) => {
      const response = await request('/api/not-found');

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Resource not found' });
    });
  });

  it('allows credentialed CORS requests only from the configured frontend origin', async () => {
    const pool = new MockPool();

    await requestWithApp(pool, async (request) => {
      const allowed = await request('/api/settings/voting', {
        headers: { Origin: 'http://localhost:5173' }
      });
      assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
      assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');

      const denied = await request('/api/settings/voting', {
        headers: { Origin: 'https://untrusted.example' }
      });
      assert.equal(denied.headers.get('access-control-allow-origin'), null);

      const preflight = await request('/api/singers/1/vote', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:5173' }
      });
      assert.equal(preflight.status, 204);

      const deniedPreflight = await request('/api/singers/1/vote', {
        method: 'OPTIONS',
        headers: { Origin: 'https://untrusted.example' }
      });
      assert.equal(deniedPreflight.status, 403);
      assert.deepEqual(await deniedPreflight.json(), { error: 'Origin not allowed' });
    });
  });
});
