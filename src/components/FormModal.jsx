import ModalFrame from "./ModalFrame";

export default function FormModal({
  open,
  title,
  description = "",
  variant = "default",
  maxWidthClass,
  submitLabel = "Simpan",
  cancelLabel = "Batal",
  submitClassName,
  onClose,
  onSubmit,
  submitting = false,
  children,
}) {
  return (
    <ModalFrame
      open={open}
      title={title}
      description={description}
      variant={variant}
      maxWidthClass={maxWidthClass}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        {children}
        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="submit"
            className={submitClassName || (variant === "danger" ? "btn-danger" : "btn-primary")}
            disabled={submitting}
          >
            {submitting ? "Menyimpan..." : submitLabel}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
