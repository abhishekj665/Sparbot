import { useState } from "react";

export default function ChatPanel({ interactions, onAsk, onApplyCode, loading, onClose }) {
  const [message, setMessage] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    if (!message.trim()) return;
    await onAsk(message);
    setMessage("");
  };

  return <aside className="assistant-panel">
    <div className="assistant-title"><div><span className="assistant-kicker">Sparbot AI coach</span><h2>Assessment discussion</h2><p>Ask about any part of the problem. You choose what to explore next.</p></div><button type="button" className="close-assistant" onClick={onClose} aria-label="Close assistant">Close</button></div>
    <div className="assistant-rules" aria-label="AI assistant rules"><b>How coaching works</b><span>Ask for one thing at a time: a constraint, an approach, an edge case, a test, or a code review.</span><span>The assistant gives the smallest useful next step, not the complete solution.</span><span>Review and test every suggestion before submission.</span></div>
    <div className="chat">{interactions.length === 0 && <div className="empty-chat">For example: “What constraints should I consider?” or “Show only the recursive postorder traversal function in Python.”</div>}{interactions.map((item, index) => <div className="message-set" key={index}><p className="user-message">{item.message}</p><p className="bot-message">{item.reply}</p>{item.suggestedCode && <button type="button" className="apply-code" onClick={() => onApplyCode(item.suggestedCode)}>Review implementation</button>}</div>)}</div>
    <form onSubmit={submit}><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask for a focused hint or review…" /><button disabled={loading || !message.trim()}>Send</button></form>
  </aside>;
}
