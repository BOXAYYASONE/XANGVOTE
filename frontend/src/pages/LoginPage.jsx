import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Toast from '../components/Toast.jsx';
import { AdminApiError, loginAdmin } from '../services/adminApi.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await loginAdmin({ username, password });
      setPassword('');
      navigate('/admin', { replace: true });
    } catch (error) {
      const message =
        error instanceof AdminApiError && error.status === 401
          ? 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
          : error instanceof Error
            ? error.message
            : 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง';
      setToast({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl sm:p-8">
        <p className="text-center text-xs font-bold uppercase tracking-[0.3em] text-amber-300">
          XANG_VOTE
        </p>
        <h1 className="mt-3 text-center text-2xl font-black">เข้าสู่ระบบผู้ดูแล</h1>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-zinc-200">
            ชื่อผู้ใช้
            <input
              autoComplete="username"
              required
              maxLength={100}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 text-base text-white outline-none focus:border-amber-300"
            />
          </label>
          <label className="block text-sm font-semibold text-zinc-200">
            รหัสผ่าน
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 text-base text-white outline-none focus:border-amber-300"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="min-h-12 w-full rounded-xl bg-amber-400 px-4 py-3 font-bold text-zinc-950 hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
        <Link
          to="/"
          className="mt-5 flex min-h-11 items-center justify-center rounded-xl text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white"
        >
          กลับไปหน้าโหวต
        </Link>
      </section>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </main>
  );
}
