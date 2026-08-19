import ChatPanel from "../components/ChatPanel";
import { useTimer } from "../hooks/useTimer";

export default function AssessmentPage({
  assessment,
  question,
  code,
  setCode,
  language,
  interactions,
  onAsk,
  onSubmit,
  loading,
  error,
}) {
  const time = useTimer(assessment.expiresAt, onSubmit);
  return (
    <main className="assessment">
      <header>
        <div>
          <h1>{question.title}</h1>
          <p>
            {question.difficulty} · {language}
          </p>
        </div>
        <strong>{time}</strong>
      </header>
      <div className="workspace">
        <section className="problem">
          <h2>Problem</h2>
          <p>{question.description}</p>
        </section>
        <section className="editor">
          <textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={`Write ${language} code here`}
          />
          <button onClick={onSubmit} disabled={loading}>
            Submit assessment
          </button>
        </section>
        <ChatPanel
          interactions={interactions}
          onAsk={onAsk}
          loading={loading}
        />
      </div>
      {error && <p className="error">{error}</p>}
    </main>
  );
}
