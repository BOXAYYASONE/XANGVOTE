import { z } from 'zod';
import * as adminService from '../services/adminService.js';
import {
  adminCookieName,
  adminCookieOptions
} from '../middlewares/adminAuth.js';
import { ApiError } from '../middlewares/errors.js';

const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(1024)
});
const singerNameSchema = z.string().trim().min(1).max(255);
const singerIdSchema = z.coerce.number().int().positive();
const votingSchema = z.object({ open: z.boolean() });

function parseSingerId(value) {
  const result = singerIdSchema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, 'Singer id must be a positive integer');
  }
  return result.data;
}

function parseSingerName(value, required) {
  if (!required && value === undefined) {
    return undefined;
  }
  const result = singerNameSchema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, 'Singer name must be a non-empty string of 255 characters or fewer');
  }
  return result.data;
}

export function login(pool, jwtSecret) {
  return async (request, response) => {
    const input = loginSchema.safeParse(request.body);
    if (!input.success) {
      throw new ApiError(400, 'Username and password are required');
    }

    const token = await adminService.login(
      pool,
      input.data.username,
      input.data.password,
      jwtSecret
    );
    response.cookie(adminCookieName, token, {
      ...adminCookieOptions,
      maxAge: 8 * 60 * 60 * 1000
    });
    response.json({ message: 'Login successful' });
  };
}

export function logout(_request, response) {
  response.clearCookie(adminCookieName, adminCookieOptions);
  response.json({ message: 'Logout successful' });
}

export function getResults(pool) {
  return async (_request, response) => {
    response.json(await adminService.getResults(pool));
  };
}

export function createSinger(pool, uploadsDirectory) {
  return async (request, response) => {
    const name = parseSingerName(request.body?.name, true);
    const singer = await adminService.createSinger(
      pool,
      name,
      request.file,
      uploadsDirectory
    );
    response.status(201).json(singer);
  };
}

export function updateSinger(pool, uploadsDirectory) {
  return async (request, response) => {
    const singerId = parseSingerId(request.params.id);
    const name = parseSingerName(request.body?.name, false);
    const singer = await adminService.updateSinger(
      pool,
      singerId,
      name,
      request.file,
      uploadsDirectory
    );
    response.json(singer);
  };
}

export function deleteSinger(pool, uploadsDirectory) {
  return async (request, response) => {
    await adminService.deleteSinger(
      pool,
      parseSingerId(request.params.id),
      uploadsDirectory
    );
    response.status(204).end();
  };
}

export function updateVoting(pool) {
  return async (request, response) => {
    const input = votingSchema.safeParse(request.body);
    if (!input.success) {
      throw new ApiError(400, 'Request body must include open as a boolean');
    }
    await adminService.setVotingStatus(pool, input.data.open);
    response.json({ is_voting_open: input.data.open });
  };
}
