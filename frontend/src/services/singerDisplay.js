function getVoteCount(singer) {
  const voteCount = Number(singer.vote_count);
  return Number.isFinite(voteCount) && voteCount >= 0 ? voteCount : 0;
}

export function sortSingersByVotes(singers) {
  return [...singers].sort((first, second) => {
    const voteDifference = getVoteCount(second) - getVoteCount(first);
    return voteDifference || String(first.name).localeCompare(String(second.name), 'th');
  });
}

export function getVoteBarColor(voteCount) {
  const count = Number(voteCount);
  if (!Number.isFinite(count) || count < 5) {
    return 'bg-red-500';
  }
  if (count < 10) {
    return 'bg-yellow-400';
  }
  return 'bg-green-500';
}

export function getVoteBarWidth(voteCount, maxVoteCount) {
  const count = Number(voteCount);
  const maximum = Number(maxVoteCount);
  if (
    !Number.isFinite(count) ||
    !Number.isFinite(maximum) ||
    count <= 0 ||
    maximum <= 0
  ) {
    return 0;
  }

  return Math.min(100, Math.max(5, (count / maximum) * 100));
}
