import { useState } from "react";

export default function ChatPanel({
  interactions,
  onAsk,
  onApplyCode,
  loading,
  onClose,
}) {
  const [message, setMessage] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    if (!message.trim()) return;
    await onAsk(message);
    setMessage("");
  };

  return (
    <aside className="assistant-panel">
      <div className="assistant-title">
        <div>
          <span className="assistant-kicker">Your coding assistant</span>
          <h2>Vibe coding assessment</h2>
          <p>Work through the required steps in order.</p>
        </div>
        <button
          type="button"
          className="close-assistant"
          onClick={onClose}
          aria-label="Close assistant"
        >
          Close
        </button>
      </div>
      <div className="assistant-rules" aria-label="AI assistant rules">
        <b>How this works</b>
        <span>
          Describe the problem, explain your data structures, then explain your
          approach.
        </span>
        <span>
          Once those steps are complete, insert the generated Java starter code
          and refine it.
        </span>
      </div>
      <div className="chat">
        {interactions.length === 0 && (
          <div className="empty-chat">
            Please describe the problem in your own words, including inputs,
            outputs, constraints, and one edge case.
          </div>
        )}
        {interactions.map((item, index) => (
          <div className="message-set" key={index}>
            <p className="user-message">{item.message}</p>
            <p className="bot-message">{item.reply}</p>
            {item.suggestedCode && (
              <button
                type="button"
                className="apply-code"
                onClick={() => onApplyCode(item.suggestedCode)}
              >
                Insert in Editor
              </button>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={submit}>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Describe the current assessment step..."
        />
        <button disabled={loading || !message.trim()}>Send</button>
      </form>
    </aside>
  );
}
