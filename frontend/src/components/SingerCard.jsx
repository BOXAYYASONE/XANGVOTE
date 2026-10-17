import { useState } from 'react';
import { getSingerImageUrl } from '../services/api.js';
import { getVoteBarColor, getVoteBarWidth } from '../services/singerDisplay.js';

function formatVoteCount(voteCount) {
  const count = Number(voteCount);
  return Number.isFinite(count) && count >= 0
    ? new Intl.NumberFormat('th-TH').format(count)
    : '0';
}

export default function SingerCard({
  singer,
  maxVoteCount,
  votingOpen,
  voting,
  onVote
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = getSingerImageUrl(singer.image_url);
  const showImage = imageUrl && !imageFailed;
  const voteBarWidth = getVoteBarWidth(singer.vote_count, maxVoteCount);

  return (
    <article className="flex items-center gap-4 rounded-3xl border border-white/10 bg-zinc-900 p-4 shadow-xl shadow-black/20 sm:gap-5 sm:p-5">
      {showImage ? (
        <img
          src={imageUrl}
          alt={`รูปของ${singer.name}`}
          loading="lazy"
          className="h-20 w-20 shrink-0 rounded-full bg-zinc-800 object-cover sm:h-24 sm:w-24"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          aria-label="ไม่มีรูปนักร้อง"
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-500 sm:h-24 sm:w-24"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 48 48"
            fill="none"
            className="h-10 w-10"
          >
            <path
              d="M24 25a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-15 15a15 15 0 0 1 30 0"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="3"
            />
          </svg>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 sm:px-4">
          <h2 className="truncate text-base font-bold text-zinc-900 sm:text-lg">
            {singer.name}
          </h2>
          <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-sm font-bold tabular-nums text-zinc-900">
            {formatVoteCount(singer.vote_count)}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`คะแนนของ${singer.name}`}
          aria-valuemin={0}
          aria-valuemax={maxVoteCount}
          aria-valuenow={Number(singer.vote_count) || 0}
          className="mt-3 h-3 w-full overflow-hidden rounded-full bg-zinc-700"
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${getVoteBarColor(
              singer.vote_count
            )}`}
            style={{ width: `${voteBarWidth}%` }}
          />
        </div>
        <button
          type="button"
          disabled={!votingOpen || voting}
          onClick={() => onVote(singer.id)}
          className="mx-auto mt-3 flex min-h-12 w-full max-w-40 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3 text-base font-bold text-zinc-950 transition hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {voting ? (
            <>
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-zinc-100"
              />
              กำลังส่งคะแนน
            </>
          ) : votingOpen ? (
            'โหวต'
          ) : (
            'ปิดรับโหวต'
          )}
        </button>
      </div>
    </article>
  );
}
