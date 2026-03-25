import { useEffect } from "react";
import { useUI } from "../context/UIContext";

const emptyMessage = (message) => {
  if (typeof message === "string") return "";
  if (message && typeof message === "object") return { ...message, text: "", title: "", type: "" };
  return message;
};

export function useToastMessage(message, setMessage) {
  const { toast } = useUI();

  useEffect(() => {
    if (!message) return;

    if (typeof message === "string") {
      if (!message.trim()) return;
      toast({ type: "info", message });
      setMessage?.(emptyMessage(message));
      return;
    }

    if (typeof message === "object" && message.text) {
      toast({
        type: message.type || "info",
        title: message.title || "",
        message: message.text,
      });
      setMessage?.(emptyMessage(message));
    }
  }, [message, setMessage, toast]);
}
