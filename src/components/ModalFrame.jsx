export default function ModalFrame({
  open,
  title,
  description = "",
  variant = "default",
  maxWidthClass = "max-w-md",
  onClose,
  children,
}) {
  if (!open) return null;

  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="app-modal-title">
      <button type="button" className="modal-backdrop" aria-label="Tutup modal" onClick={onClose} />
      <div className={`modal-card ${maxWidthClass}`}>
        <div className={`modal-icon is-${variant}`}>
          {variant === "danger" ? "!" : "?"}
        </div>
        <div className="space-y-2">
          <h3 id="app-modal-title" className="section-title">
            {title}
          </h3>
          {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
