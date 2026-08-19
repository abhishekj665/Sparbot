import { useState } from "react";

export default function ChatPanel({ interactions, onAsk, loading }) {
  const [message, setMessage] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    if (!message.trim()) return;
    await onAsk(message);
    setMessage("");
  };
  return (
    <aside>
      <h2>AI assistant</h2>
      <div className="chat">
        {interactions.map((item, index) => (
          <div key={index}>
            <p>
              <b>You:</b> {item.message}
            </p>
            <p>
              <b>Sparbot:</b> {item.reply}
            </p>
          </div>
        ))}
      </div>
      <form onSubmit={submit}>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Ask for a hint or debugging help"
        />
        <button disabled={loading}>Ask Groq</button>
      </form>
    </aside>
  );
}
