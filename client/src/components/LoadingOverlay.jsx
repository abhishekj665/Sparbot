export default function LoadingOverlay({ active, message = "Working..." }) {
  if (!active) return null;
  return (
    <div
      className="loading-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="loading-card">
        <span className="loading-spinner" aria-hidden="true" />
        <span>{message}</span>
      </div>
    </div>
  );
}
