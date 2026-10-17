import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SingerCard from '../components/SingerCard.jsx';
import Toast from '../components/Toast.jsx';
import {
  AdminApiError,
  createSinger,
  deleteSinger,
  getAdminImageUrl,
  getAdminResults,
  getVotingStatus,
  logoutAdmin,
  updateSingerName,
  updateVotingStatus
} from '../services/adminApi.js';
import { sortSingersByVotes } from '../services/singerDisplay.js';
import {
  validateSingerImage,
  validateSingerSubmission
} from '../services/imageValidation.js';

export default function AdminPage() {
  const navigate = useNavigate();
  const [singers, setSingers] = useState([]);
  const [votingOpen, setVotingOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingVoting, setSavingVoting] = useState(false);
  const [submittingSinger, setSubmittingSinger] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [name, setName] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageError, setImageError] = useState('');
  const [editingSingerId, setEditingSingerId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [toast, setToast] = useState(null);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [results, status] = await Promise.all([
        getAdminResults(),
        getVotingStatus()
      ]);
      setSingers(sortSingersByVotes(results));
      setVotingOpen(status);
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        navigate('/admin/login', { replace: true });
        return;
      }
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ'
      });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    if (!image) {
      setImagePreview('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(image);
    setImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timeout = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function handleImageChange(event) {
    const selectedImage = event.target.files?.[0] || null;
    event.target.value = '';
    setImageError('');
    if (!selectedImage) {
      setImage(null);
      return;
    }
    const validation = validateSingerImage(selectedImage);
    if (!validation.valid) {
      setImage(null);
      setImageError(validation.error);
      return;
    }
    setImage(selectedImage);
  }

  async function handleAddSinger(event) {
    event.preventDefault();
    const validation = validateSingerSubmission(name, image);
    if (!validation.valid) {
      setImageError(validation.error);
      return;
    }
    setSubmittingSinger(true);
    try {
      await createSinger(name.trim(), image);
      setName('');
      setImage(null);
      setImageError('');
      setToast({ type: 'success', message: 'เพิ่มนักร้องเรียบร้อยแล้ว' });
      await loadAdminData();
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        navigate('/admin/login', { replace: true });
        return;
      }
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'เพิ่มนักร้องไม่สำเร็จ'
      });
    } finally {
      setSubmittingSinger(false);
    }
  }

  async function handleVotingToggle(event) {
    const open = event.target.checked;
    setSavingVoting(true);
    try {
      await updateVotingStatus(open);
      const nextStatus = await getVotingStatus();
      setVotingOpen(nextStatus);
      setToast({
        type: 'success',
        message: nextStatus ? 'เปิดรับโหวตแล้ว' : 'ปิดรับโหวตแล้ว'
      });
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        navigate('/admin/login', { replace: true });
        return;
      }
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'เปลี่ยนสถานะโหวตไม่สำเร็จ'
      });
    } finally {
      setSavingVoting(false);
    }
  }

  async function handleSaveName(singerId) {
    if (!editingName.trim()) {
      setToast({ type: 'error', message: 'กรุณาระบุชื่อนักร้อง' });
      return;
    }
    try {
      await updateSingerName(singerId, editingName.trim());
      setEditingSingerId(null);
      setEditingName('');
      setToast({ type: 'success', message: 'แก้ไขชื่อนักร้องแล้ว' });
      await loadAdminData();
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        navigate('/admin/login', { replace: true });
        return;
      }
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'แก้ไขชื่อไม่สำเร็จ'
      });
    }
  }

  async function handleDeleteSinger(singer) {
    if (!window.confirm(`ยืนยันลบนักร้อง "${singer.name}" และคะแนนทั้งหมดหรือไม่?`)) {
      return;
    }
    try {
      await deleteSinger(singer.id);
      setToast({ type: 'success', message: 'ลบนักร้องเรียบร้อยแล้ว' });
      await loadAdminData();
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        navigate('/admin/login', { replace: true });
        return;
      }
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'ลบนักร้องไม่สำเร็จ'
      });
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logoutAdmin();
    } catch (error) {
      setToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'ออกจากระบบไม่สำเร็จ'
      });
      setLoggingOut(false);
      return;
    }
    navigate('/admin/login', { replace: true });
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-white sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-300">XANG_VOTE</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">จัดการระบบโหวต</h1>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="min-h-11 rounded-xl border border-white/10 px-5 py-2 font-semibold text-zinc-200 hover:bg-white/10 disabled:opacity-60"
          >
            {loggingOut ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ'}
          </button>
        </header>

        <section className="mt-7 rounded-2xl border border-white/10 bg-zinc-900 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">สถานะการโหวต</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {votingOpen ? 'กำลังเปิดรับคะแนน' : 'ปิดรับคะแนนอยู่'}
              </p>
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <span className="text-sm font-semibold">{votingOpen ? 'เปิด' : 'ปิด'}</span>
              <input
                type="checkbox"
                role="switch"
                aria-label="เปิดหรือปิดการโหวต"
                checked={votingOpen}
                disabled={savingVoting || loading}
                onChange={handleVotingToggle}
                className="h-6 w-11 cursor-pointer accent-amber-400 disabled:cursor-wait"
              />
            </label>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-zinc-900 p-5 sm:p-6">
          <h2 className="text-lg font-bold">เพิ่มนักร้อง</h2>
          <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleAddSinger}>
            <label className="block text-sm font-semibold text-zinc-200">
              ชื่อนักร้อง
              <input
                required
                maxLength={255}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 text-base text-white outline-none focus:border-amber-300"
              />
            </label>
            <label className="block text-sm font-semibold text-zinc-200">
              รูปนักร้อง (JPG, PNG, WebP ไม่เกิน 5 MB)
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="mt-2 block min-h-12 w-full cursor-pointer rounded-xl border border-white/10 bg-zinc-950 text-sm text-zinc-300 file:mr-3 file:min-h-12 file:border-0 file:bg-zinc-800 file:px-3 file:font-semibold file:text-white"
              />
            </label>
            {imageError && (
              <p role="alert" className="text-sm text-rose-300 sm:col-span-2">
                {imageError}
              </p>
            )}
            {imagePreview && (
              <div className="flex items-center gap-4 sm:col-span-2">
                <img
                  src={imagePreview}
                  alt="ตัวอย่างรูปนักร้อง"
                  className="h-20 w-20 rounded-full object-cover"
                />
                <span className="break-all text-sm text-zinc-400">{image.name}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={submittingSinger}
              className="min-h-12 rounded-xl bg-amber-400 px-5 py-3 font-bold text-zinc-950 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
            >
              {submittingSinger ? 'กำลังบันทึก...' : 'เพิ่มนักร้อง'}
            </button>
          </form>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-black">รายชื่อนักร้องและคะแนน</h2>
          {loading ? (
            <p role="status" className="py-10 text-center text-zinc-400">
              กำลังโหลดข้อมูล...
            </p>
          ) : singers.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-white/10 bg-zinc-900 p-6 text-center text-zinc-400">
              ยังไม่มีรายชื่อนักร้อง
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {singers.map((singer) => (
                <article
                  key={singer.id}
                  className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-zinc-900 p-4 sm:flex-row sm:items-center"
                >
                  <img
                    src={getAdminImageUrl(singer.image_url)}
                    alt={`รูปของ${singer.name}`}
                    loading="lazy"
                    className="h-16 w-16 shrink-0 rounded-full bg-zinc-800 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    {editingSingerId === singer.id ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          autoFocus
                          maxLength={255}
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          aria-label="แก้ไขชื่อนักร้อง"
                          className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-950 px-3 text-white outline-none focus:border-amber-300"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveName(singer.id)}
                          className="min-h-11 rounded-lg bg-emerald-500 px-4 font-semibold text-zinc-950 hover:bg-emerald-400"
                        >
                          บันทึก
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSingerId(null)}
                          className="min-h-11 rounded-lg bg-zinc-800 px-4 font-semibold text-white hover:bg-zinc-700"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    ) : (
                      <h3 className="truncate font-bold">{singer.name}</h3>
                    )}
                    <p className="mt-1 text-sm text-zinc-400">
                      คะแนนรวม:{' '}
                      <span className="font-bold tabular-nums text-amber-300">
                        {Number(singer.vote_count) || 0}
                      </span>
                    </p>
                  </div>
                  {editingSingerId !== singer.id && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSingerId(singer.id);
                          setEditingName(singer.name);
                        }}
                        className="min-h-11 flex-1 rounded-lg bg-zinc-800 px-4 font-semibold hover:bg-zinc-700 sm:flex-none"
                      >
                        แก้ไขชื่อ
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSinger(singer)}
                        className="min-h-11 flex-1 rounded-lg bg-rose-600 px-4 font-semibold hover:bg-rose-500 sm:flex-none"
                      >
                        ลบ
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}
