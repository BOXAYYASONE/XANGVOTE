import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getVoteBarColor,
  getVoteBarWidth,
  sortSingersByVotes
} from './singerDisplay.js';

describe('sortSingersByVotes', () => {
  it('sorts by descending vote count and Thai name for tied scores', () => {
    const singers = [
      { id: 1, name: 'มะลิ', vote_count: 7 },
      { id: 2, name: 'อรุณ', vote_count: 12 },
      { id: 3, name: 'กานต์', vote_count: 7 },
      { id: 4, name: 'สายฝน', vote_count: 12 }
    ];

    assert.deepEqual(
      sortSingersByVotes(singers).map((singer) => singer.id),
      [4, 2, 3, 1]
    );
    assert.deepEqual(
      singers.map((singer) => singer.id),
      [1, 2, 3, 4]
    );
  });

  it('treats invalid vote counts as zero', () => {
    const singers = [
      { id: 1, name: 'มะลิ', vote_count: 'unknown' },
      { id: 2, name: 'อรุณ', vote_count: 1 }
    ];

    assert.deepEqual(
      sortSingersByVotes(singers).map((singer) => singer.id),
      [2, 1]
    );
  });
});

describe('getVoteBarColor', () => {
  it('selects red below 5, yellow from 5 through 9, and green at 10 or higher', () => {
    assert.equal(getVoteBarColor(0), 'bg-red-500');
    assert.equal(getVoteBarColor(4), 'bg-red-500');
    assert.equal(getVoteBarColor(5), 'bg-yellow-400');
    assert.equal(getVoteBarColor(9), 'bg-yellow-400');
    assert.equal(getVoteBarColor(10), 'bg-green-500');
  });
});

describe('getVoteBarWidth', () => {
  it('calculates a percentage with a visible 5 percent minimum and a 100 percent maximum', () => {
    assert.equal(getVoteBarWidth(25, 100), 25);
    assert.equal(getVoteBarWidth(1, 100), 5);
    assert.equal(getVoteBarWidth(150, 100), 100);
  });

  it('returns zero when the maximum score or singer score is zero', () => {
    assert.equal(getVoteBarWidth(0, 0), 0);
    assert.equal(getVoteBarWidth(10, 0), 0);
    assert.equal(getVoteBarWidth(0, 10), 0);
  });
});
