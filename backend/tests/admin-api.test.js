import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { afterEach, before, describe, it } from 'node:test';
import bcrypt from 'bcrypt';
import sharp from 'sharp';
import { createApp } from '../src/app.js';

const jwtSecret = 'test-only-jwt-secret-with-enough-entropy';
const adminPassword = 'test-admin-password';
let passwordHash;
const servers = [];
const uploadDirectories = [];

before(async () => {
  passwordHash = await bcrypt.hash(adminPassword, 4);
});

class AdminMockPool {
  admins = [{ id: 1, username: 'admin', password_hash: passwordHash }];
  singers = [{ id: 1, name: 'Singer One', image_url: '/uploads/old-image.webp' }];
  votes = [
    { id: 1, singer_id: 1, voter_token: 'voter-1' },
    { id: 2, singer_id: 1, voter_token: 'voter-2' }
  ];
  settings = new Map([['is_voting_open', 'false']]);

  async execute(sql, values = []) {
    if (sql.startsWith('SELECT id, username, password_hash FROM admins')) {
      return [this.admins.filter((admin) => admin.username === values[0]), []];
    }
    if (sql.startsWith('SELECT singers.id')) {
      return [
        this.singers.map((singer) => ({
          ...singer,
          created_at: '2026-01-01 00:00:00',
          vote_count: this.votes.filter((vote) => vote.singer_id === singer.id).length
        })),
        []
      ];
    }
    if (sql.startsWith('SELECT id, name, image_url FROM singers')) {
      return [
        this.singers
          .filter((singer) => singer.id === values[0])
          .map((singer) => ({ ...singer })),
        []
      ];
    }
    if (sql.startsWith('INSERT INTO singers')) {
      const id = Math.max(0, ...this.singers.map((singer) => singer.id)) + 1;
      this.singers.push({ id, name: values[0], image_url: values[1] });
      return [{ insertId: id, affectedRows: 1 }, []];
    }
    if (sql.startsWith('UPDATE singers SET')) {
      const singer = this.singers.find((entry) => entry.id === values[2]);
      if (!singer) {
        return [{ affectedRows: 0 }, []];
      }
      singer.name = values[0];
      singer.image_url = values[1];
      return [{ affectedRows: 1 }, []];
    }
    if (sql.startsWith('DELETE FROM singers')) {
      const index = this.singers.findIndex((singer) => singer.id === values[0]);
      if (index === -1) {
        return [{ affectedRows: 0 }, []];
      }
      this.singers.splice(index, 1);
      this.votes = this.votes.filter((vote) => vote.singer_id !== values[0]);
      return [{ affectedRows: 1 }, []];
    }
    if (sql.startsWith('INSERT INTO settings')) {
      this.settings.set(values[0], values[1]);
      return [{ affectedRows: 1 }, []];
    }
    if (sql.startsWith('SELECT value FROM settings')) {
      return [[{ value: this.settings.get(values[0]) }], []];
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
      const id = this.votes.length + 1;
      this.votes.push({ id, singer_id: values[0], voter_token: values[1] });
      return [{ insertId: id, affectedRows: 1 }, []];
    }
    throw new Error(`Unexpected SQL in test: ${sql}`);
  }
}

async function requestWithAdminApp(pool, callback) {
  const uploadsDirectory = await mkdtemp(path.join(tmpdir(), 'xang-vote-uploads-'));
  uploadDirectories.push(uploadsDirectory);
  const server = createApp(pool, 'http://localhost:5173', {
    jwtSecret,
    uploadsDirectory
  }).listen(0, '127.0.0.1');
  servers.push(server);
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return callback(
    async (route, options = {}) =>
      fetch(`${baseUrl}${route}`, {
        ...options,
        headers: { Connection: 'close', ...options.headers }
      }),
    uploadsDirectory
  );
}

async function login(request) {
  const response = await request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: adminPassword })
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => {
      server.closeAllConnections();
      return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    })
  );
  await Promise.all(uploadDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('admin API', () => {
  it('rejects invalid credentials and logs in with an httpOnly JWT cookie', async () => {
    const pool = new AdminMockPool();

    await requestWithAdminApp(pool, async (request) => {
      const invalidResponse = await request('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'wrong-password' })
      });
      assert.equal(invalidResponse.status, 401);
      assert.deepEqual(await invalidResponse.json(), {
        error: 'Invalid username or password'
      });

      const cookie = await login(request);
      assert.match(invalidResponse.headers.get('content-type'), /application\/json/);
      const loginResponse = await request('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: adminPassword })
      });
      assert.equal(loginResponse.status, 200);
      assert.match(loginResponse.headers.get('set-cookie'), /HttpOnly/i);
      assert.match(loginResponse.headers.get('set-cookie'), /Path=\/api\/admin/i);

      const resultsResponse = await request('/api/admin/results', {
        headers: { Cookie: cookie }
      });
      assert.equal(resultsResponse.status, 200);
      assert.equal((await resultsResponse.json())[0].vote_count, 2);
    });
  });

  it('protects admin routes and returns 401 without a valid login cookie', async () => {
    const pool = new AdminMockPool();

    await requestWithAdminApp(pool, async (request) => {
      const response = await request('/api/admin/results');
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: 'Authentication required' });
    });
  });

  it('rejects upload content that is not a supported image regardless of its MIME type', async () => {
    const pool = new AdminMockPool();

    await requestWithAdminApp(pool, async (request) => {
      const cookie = await login(request);
      const form = new FormData();
      form.set('name', 'Not an image');
      form.set('image', new Blob(['plain text, not an image'], { type: 'image/png' }), 'fake.png');
      const response = await request('/api/admin/singers', {
        method: 'POST',
        headers: { Cookie: cookie },
        body: form
      });

      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), {
        error: 'Uploaded file is not a valid JPG, PNG, or WebP image'
      });
      assert.equal(pool.singers.length, 1);
    });
  });

  it('rejects uploaded files larger than 5 MB', async () => {
    const pool = new AdminMockPool();

    await requestWithAdminApp(pool, async (request) => {
      const cookie = await login(request);
      const form = new FormData();
      form.set('name', 'Oversized file');
      form.set(
        'image',
        new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: 'image/png' }),
        'oversized.png'
      );
      const response = await request('/api/admin/singers', {
        method: 'POST',
        headers: { Cookie: cookie },
        body: form
      });

      assert.equal(response.status, 413);
      assert.deepEqual(await response.json(), {
        error: 'Uploaded image must not exceed 5 MB'
      });
      assert.equal(pool.singers.length, 1);
    });
  });

  it('stores a resized WebP image, replaces old images, and serves uploaded files', async () => {
    const pool = new AdminMockPool();
    pool.singers[0].image_url =
      '/uploads/123e4567-e89b-12d3-a456-426614174000.webp';

    await requestWithAdminApp(pool, async (request, uploadsDirectory) => {
      const cookie = await login(request);
      await writeFile(
        path.join(uploadsDirectory, path.basename(pool.singers[0].image_url)),
        'old image'
      );
      const png = await sharp({
        create: { width: 1000, height: 20, channels: 3, background: '#f00' }
      })
        .png()
        .toBuffer();
      const form = new FormData();
      form.set('name', 'New Singer');
      form.set('image', new Blob([png], { type: 'image/png' }), 'singer.png');
      const response = await request('/api/admin/singers', {
        method: 'POST',
        headers: { Cookie: cookie },
        body: form
      });

      assert.equal(response.status, 201);
      const createdSinger = await response.json();
      assert.match(createdSinger.image_url, /^\/uploads\/[0-9a-f-]{36}\.webp$/i);
      const filename = path.basename(createdSinger.image_url);
      const storedImage = await readFile(path.join(uploadsDirectory, filename));
      const metadata = await sharp(storedImage).metadata();
      assert.equal(metadata.format, 'webp');
      assert.equal(metadata.width, 800);

      const staticResponse = await request(createdSinger.image_url);
      assert.equal(staticResponse.status, 200);
      assert.equal(staticResponse.headers.get('content-type'), 'image/webp');

      const updateForm = new FormData();
      updateForm.set('name', 'Renamed Singer');
      updateForm.set('image', new Blob([png], { type: 'image/png' }), 'replacement.png');
      const updateResponse = await request(`/api/admin/singers/${createdSinger.id}`, {
        method: 'PUT',
        headers: { Cookie: cookie },
        body: updateForm
      });
      assert.equal(updateResponse.status, 200);
      const updatedSinger = await updateResponse.json();
      assert.deepEqual(pool.singers.find((singer) => singer.id === createdSinger.id), {
        id: createdSinger.id,
        name: 'Renamed Singer',
        image_url: updatedSinger.image_url
      });
      assert.notEqual(updatedSinger.image_url, createdSinger.image_url);
      assert.deepEqual(await readdir(uploadsDirectory), [
        '123e4567-e89b-12d3-a456-426614174000.webp',
        path.basename(updatedSinger.image_url)
      ].sort());
    });
  });

  it('updates voting status and deletes a singer with its votes and image', async () => {
    const pool = new AdminMockPool();
    pool.singers[0].image_url = '/uploads/123e4567-e89b-12d3-a456-426614174000.webp';

    await requestWithAdminApp(pool, async (request, uploadsDirectory) => {
      const cookie = await login(request);
      await writeFile(
        path.join(uploadsDirectory, path.basename(pool.singers[0].image_url)),
        'test image'
      );

      const invalidStatus = await request('/api/admin/voting', {
        method: 'PATCH',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ open: 'true' })
      });
      assert.equal(invalidStatus.status, 400);
      assert.deepEqual(await invalidStatus.json(), {
        error: 'Request body must include open as a boolean'
      });

      const statusResponse = await request('/api/admin/voting', {
        method: 'PATCH',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ open: true })
      });
      assert.equal(statusResponse.status, 200);
      assert.deepEqual(await statusResponse.json(), { is_voting_open: true });
      assert.equal(pool.settings.get('is_voting_open'), 'true');

      const deleteResponse = await request('/api/admin/singers/1', {
        method: 'DELETE',
        headers: { Cookie: cookie }
      });
      assert.equal(deleteResponse.status, 204);
      assert.equal(pool.singers.length, 0);
      assert.equal(pool.votes.length, 0);
      assert.deepEqual(await readdir(uploadsDirectory), []);
    });
  });
});
