import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import ConfirmModal from "../components/ConfirmModal";
import ToastViewport from "../components/ToastViewport";

const UIContext = createContext(null);

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    description: "",
    confirmLabel: "",
    cancelLabel: "",
    variant: "default",
  });
  const confirmResolverRef = useRef(null);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((input) => {
    const payload =
      typeof input === "string"
        ? { message: input, type: "info" }
        : {
            message: input?.message || "",
            title: input?.title || "",
            type: input?.type || "info",
            duration: input?.duration ?? 3200,
          };

    if (!payload.message) return;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { ...payload, id }]);

    window.setTimeout(() => {
      dismissToast(id);
    }, payload.duration);
  }, [dismissToast]);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmState({
        open: true,
        title: options.title || "Konfirmasi",
        description: options.description || "",
        confirmLabel: options.confirmLabel || "Ya, lanjutkan",
        cancelLabel: options.cancelLabel || "Batal",
        variant: options.variant || "default",
      });
    });
  }, []);

  const closeConfirm = useCallback((result) => {
    setConfirmState((current) => ({ ...current, open: false }));
    if (confirmResolverRef.current) {
      confirmResolverRef.current(result);
      confirmResolverRef.current = null;
    }
  }, []);

  const value = useMemo(
    () => ({
      toast,
      confirm,
      success: (message, title = "Berhasil") => toast({ type: "success", title, message }),
      error: (message, title = "Terjadi masalah") => toast({ type: "error", title, message }),
      info: (message, title = "Informasi") => toast({ type: "info", title, message }),
    }),
    [toast, confirm],
  );

  return (
    <UIContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        variant={confirmState.variant}
        onCancel={() => closeConfirm(false)}
        onConfirm={() => closeConfirm(true)}
      />
    </UIContext.Provider>
  );
}

export const useUI = () => useContext(UIContext);
