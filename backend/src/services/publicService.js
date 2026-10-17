import { randomUUID } from 'node:crypto';
import * as settingsModel from '../models/settingsModel.js';
import * as singerModel from '../models/singerModel.js';
import * as voteModel from '../models/voteModel.js';
import { ApiError } from '../middlewares/errors.js';

export async function getSingers(pool) {
  const singers = await singerModel.findAllWithVoteCounts(pool);
  return singers.map((singer) => ({
    ...singer,
    vote_count: Number(singer.vote_count)
  }));
}

export async function getVotingStatus(pool) {
  const value = await settingsModel.findValueByKey(pool, 'is_voting_open');
  return value === 'true' || value === '1';
}

export async function voteForSinger(pool, singerId, voterToken) {
  if (!(await getVotingStatus(pool))) {
    throw new ApiError(403, 'Voting is currently closed');
  }

  if (!(await singerModel.existsById(pool, singerId))) {
    throw new ApiError(404, 'Singer not found');
  }

  if (await voteModel.existsForVoter(pool, singerId, voterToken)) {
    throw new ApiError(409, 'You have already voted for this singer');
  }

  try {
    await voteModel.createVote(pool, singerId, voterToken);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new ApiError(409, 'You have already voted for this singer');
    }
    throw error;
  }
}

export function createVoterToken() {
  return randomUUID();
}
