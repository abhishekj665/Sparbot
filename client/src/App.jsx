import "./App.css";
import LoadingOverlay from "./components/LoadingOverlay";
import Toast from "./components/Toast";
import { useAssessmentSession } from "./hooks/useAssessmentSession";
import AssessmentPage from "./pages/AssessmentPage";
import AuthPage from "./pages/AuthPage";
import ResultPage from "./pages/ResultPage";
import SetupPage from "./pages/SetupPage";

export default function App() {
  const session = useAssessmentSession();

  if (!session.token) {
    return (
      <AppChrome session={session}>
        <AuthPage
          mode={session.mode}
          setMode={session.setMode}
          onSubmit={session.authenticate}
          loading={session.loading}
          error={session.error}
        />
      </AppChrome>
    );
  }
  if (!session.assessment) {
    return (
      <AppChrome session={session}>
        <SetupPage
          onStart={session.start}
          onSignOut={session.signOut}
          loading={session.loading}
          error={session.error}
        />
      </AppChrome>
    );
  }
  if (session.evaluation) {
    return (
      <AppChrome session={session}>
        <ResultPage
          evaluation={session.evaluation}
          code={session.code}
          onRestart={session.restart}
        />
      </AppChrome>
    );
  }
  return (
    <AppChrome session={session}>
      <AssessmentPage
        assessment={session.assessment}
        question={session.question}
        code={session.code}
        setCode={session.setCode}
        language={session.language}
        interactions={session.interactions}
        onAsk={session.ask}
        onApplyCode={session.setCode}
        onRun={session.execute}
        onRunTests={session.executeTests}
        runResult={session.runResult}
        testResult={session.testResult}
        onSubmit={() => session.submit(false)}
        onExit={() => session.submit(true)}
        loading={session.loading}
        error={session.error}
      />
    </AppChrome>
  );
}

function AppChrome({ session, children }) {
  return (
    <>
      {children}
      <LoadingOverlay
        active={session.loading || session.restoringAssessment}
        message={
          session.restoringAssessment
            ? "Loading your assessment..."
            : session.loadingMessage
        }
      />
      <Toast toast={session.toast} onDismiss={() => session.setToast(null)} />
    </>
  );
}
