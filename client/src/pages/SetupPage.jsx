import AssessmentSetup from "../components/AssessmentSetup";

export default function SetupPage({ onStart, onSignOut, loading, error }) {
  return (
    <main className="setup">
      <header>
        <h1>Sparbot</h1>
        <button className="link" onClick={onSignOut}>
          Sign out
        </button>
      </header>
      <AssessmentSetup onStart={onStart} loading={loading} />
      {error && <p className="error">{error}</p>}
    </main>
  );
}
