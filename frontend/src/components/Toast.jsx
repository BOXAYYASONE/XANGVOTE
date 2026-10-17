export default function Toast({ toast, onDismiss }) {
  if (!toast) {
    return null;
  }

  const isSuccess = toast.type === 'success';

  return (
    <div
      role={isSuccess ? 'status' : 'alert'}
      aria-live={isSuccess ? 'polite' : 'assertive'}
      className={`fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl sm:bottom-6 ${
        isSuccess
          ? 'border-emerald-300/20 bg-emerald-950 text-emerald-100'
          : 'border-rose-300/20 bg-rose-950 text-rose-100'
      }`}
    >
      <span className="flex-1 text-sm font-medium leading-6">{toast.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="ปิดข้อความแจ้งเตือน"
        className="flex min-h-8 min-w-8 items-center justify-center rounded-lg text-current/80 hover:bg-white/10"
      >
        ×
      </button>
    </div>
  );
}
