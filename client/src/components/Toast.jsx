import { useEffect } from "react";

export default function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timeout);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return <div className={`toast toast-${toast.type || "error"}`} role="alert" aria-live="assertive">
    <span>{toast.message}</span>
    <button type="button" onClick={onDismiss} aria-label="Dismiss message">×</button>
  </div>;
}
