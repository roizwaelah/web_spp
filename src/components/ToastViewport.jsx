export default function ToastViewport({ toasts = [], onDismiss }) {
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-card is-${toast.type || "info"}`}>
          <div className="toast-card__body">
            {toast.title ? <p className="toast-card__title">{toast.title}</p> : null}
            <p className="toast-card__message">{toast.message}</p>
          </div>
          <button
            type="button"
            className="toast-card__close"
            onClick={() => onDismiss?.(toast.id)}
            aria-label="Tutup notifikasi"
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
