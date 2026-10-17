import { useCallback, useEffect, useState } from 'react';
import SingerCard from '../components/SingerCard.jsx';
import Toast from '../components/Toast.jsx';
import { ApiError, getSingers, getVotingStatus, voteForSinger } from '../services/api.js';
import { sortSingersByVotes } from '../services/singerDisplay.js';

function getVoteErrorMessage(error) {
  if (error instanceof ApiError && error.status === 409) {
    return 'คุณโหวตให้นักร้องคนนี้ไปแล้ว';
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'ระบบปิดโหวตแล้ว ขอบคุณที่ร่วมสนุก';
  }
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง';
}

export default function HomePage() {
  const [singers, setSingers] = useState([]);
  const [votingOpen, setVotingOpen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [votingSingerId, setVotingSingerId] = useState(null);
  const [toast, setToast] = useState(null);

  const loadHomePage = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [nextSingers, nextVotingOpen] = await Promise.all([
        getSingers(),
        getVotingStatus()
      ]);
      setSingers(sortSingersByVotes(nextSingers));
      setVotingOpen(nextVotingOpen);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHomePage();
  }, [loadHomePage]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timeout = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function handleVote(singerId) {
    setVotingSingerId(singerId);
    try {
      await voteForSinger(singerId);
      setToast({ type: 'success', message: 'โหวตสำเร็จ ขอบคุณสำหรับคะแนนของคุณ!' });
      await loadHomePage();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setVotingOpen(false);
      }
      setToast({ type: 'error', message: getVoteErrorMessage(error) });
    } finally {
      setVotingSingerId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-950 to-black text-white">
      <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <header className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-300 sm:text-sm">
            XANG_VOTE
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
            ส่งคะแนนให้เสียงที่คุณรัก
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
            เลือกนักร้องคนโปรดของคุณ แล้วร่วมส่งกำลังใจผ่านคะแนนโหวต
          </p>
          <div
            className={`mx-auto mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
              votingOpen === true
                ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                : votingOpen === false
                  ? 'border-zinc-700 bg-zinc-800 text-zinc-300'
                  : 'border-white/10 bg-white/5 text-zinc-400'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${
                votingOpen === true
                  ? 'bg-emerald-400'
                  : votingOpen === false
                    ? 'bg-zinc-500'
                    : 'bg-zinc-600'
              }`}
            />
            {votingOpen === true
              ? 'กำลังเปิดรับโหวต'
              : votingOpen === false
                ? 'ปิดรับโหวต'
                : 'กำลังตรวจสอบสถานะ'}
          </div>
        </header>

        {loading ? (
          <div role="status" className="py-20 text-center text-zinc-400">
            กำลังโหลดรายชื่อนักร้อง...
          </div>
        ) : loadError ? (
          <section className="mx-auto max-w-lg rounded-2xl border border-rose-300/20 bg-rose-950/50 p-6 text-center">
            <p role="alert" className="text-rose-100">{loadError}</p>
            <button
              type="button"
              onClick={loadHomePage}
              className="mt-4 min-h-11 rounded-xl bg-white/10 px-5 py-2 font-semibold text-white hover:bg-white/15"
            >
              ลองโหลดอีกครั้ง
            </button>
          </section>
        ) : singers.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-12 text-center text-zinc-400">
            ยังไม่มีรายชื่อนักร้อง
          </div>
        ) : (
          <section aria-label="รายชื่อนักร้อง" className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:gap-5">
            {singers.map((singer) => (
              <SingerCard
                key={singer.id}
                singer={singer}
                maxVoteCount={Number(singers[0]?.vote_count) || 0}
                votingOpen={votingOpen}
                voting={votingSingerId === singer.id}
                onVote={handleVote}
              />
            ))}
          </section>
        )}
      </div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}
