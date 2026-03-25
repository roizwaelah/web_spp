export default function ConfirmModal({
  open,
  title = "Konfirmasi",
  description = "",
  confirmLabel = "Ya, lanjutkan",
  cancelLabel = "Batal",
  variant = "default",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <button type="button" className="modal-backdrop" aria-label="Tutup modal" onClick={onCancel} />
      <div className="modal-card">
        <div className={`modal-icon is-${variant}`}>
          {variant === "danger" ? "!" : "?"}
        </div>
        <div className="space-y-2">
          <h3 id="confirm-modal-title" className="section-title">
            {title}
          </h3>
          {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={variant === "danger" ? "btn-danger" : "btn-primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
