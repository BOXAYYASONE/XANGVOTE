import { z } from 'zod';
import * as publicService from '../services/publicService.js';
import { ApiError } from '../middlewares/errors.js';

const singerIdSchema = z.coerce.number().int().positive();
const voterTokenSchema = z.string().uuid();

export function getSingers(pool) {
  return async (_request, response) => {
    const singers = await publicService.getSingers(pool);
    response.json(singers);
  };
}

export function getVotingStatus(pool) {
  return async (_request, response) => {
    const isVotingOpen = await publicService.getVotingStatus(pool);
    response.json({ is_voting_open: isVotingOpen });
  };
}

export function voteForSinger(pool) {
  return async (request, response) => {
    const parsedSingerId = singerIdSchema.safeParse(request.params.id);
    if (!parsedSingerId.success) {
      throw new ApiError(400, 'Singer id must be a positive integer');
    }

    const parsedCookie = voterTokenSchema.safeParse(request.cookies.voter_token);
    const voterToken = parsedCookie.success
      ? parsedCookie.data
      : publicService.createVoterToken();

    await publicService.voteForSinger(pool, parsedSingerId.data, voterToken);

    if (!parsedCookie.success) {
      response.cookie('voter_token', voterToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/'
      });
    }

    response.status(201).json({ message: 'Vote recorded successfully' });
  };
}
