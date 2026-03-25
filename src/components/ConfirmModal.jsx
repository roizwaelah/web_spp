import ModalFrame from "./ModalFrame";

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
  return (
    <ModalFrame
      open={open}
      title={title}
      description={description}
      variant={variant}
      onClose={onCancel}
    >
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
    </ModalFrame>
  );
}
