export default function ModalFrame({
  open,
  title,
  description = "",
  variant = "default",
  maxWidthClass = "max-w-md",
  showIcon = true,
  showHeader = true,
  cardClassName = "",
  onClose,
  children,
}) {
  if (!open) return null;

  return (
    <div className="modal-shell" role="dialog" aria-modal="true" aria-labelledby="app-modal-title">
      <button type="button" className="modal-backdrop" aria-label="Tutup modal" onClick={onClose} />
      <div className={`modal-card ${maxWidthClass} ${cardClassName}`.trim()}>
        {showIcon ? (
          <div className={`modal-icon is-${variant}`}>
            {variant === "danger" ? "!" : "?"}
          </div>
        ) : null}
        {showHeader ? (
          <div className="space-y-2">
            <h3 id="app-modal-title" className="section-title">
              {title}
            </h3>
            {description ? <p className="text-sm text-slate-500">{description}</p> : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
