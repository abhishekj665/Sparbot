import AuthForm from "../components/AuthForm";

export default function AuthPage({ mode, setMode, onSubmit, loading, error }) {
  return (
    <main className="auth">
      <h1>Sparbot</h1>
      <p>AI-assisted coding assessments</p>
      <AuthForm mode={mode} onSubmit={onSubmit} loading={loading} />
      <button
        className="link"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login"
          ? "Need an account? Register"
          : "Already registered? Login"}
      </button>
      {error && <p className="error">{error}</p>}
    </main>
  );
}
