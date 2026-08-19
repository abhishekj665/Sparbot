import { useEffect, useState } from "react";
import "./App.css";
import { setToken } from "./services/api";
import { login, register } from "./services/auth.service";
import { askAssistant, startAssessment, submitAssessment } from "./services/assessment.service";
import AuthPage from "./pages/AuthPage";
import SetupPage from "./pages/SetupPage";
import AssessmentPage from "./pages/AssessmentPage";
import ResultPage from "./pages/ResultPage";

export default function App() {
  const [token, setAuthToken] = useState(localStorage.getItem("sparbot_token") || "");
  const [mode, setMode] = useState("login");
  const [assessment, setAssessment] = useState(null);
  const [question, setQuestion] = useState(null);
  const [code, setCode] = useState("");
  const [interactions, setInteractions] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => setToken(token), [token]);
  const run = async (action) => {
    setError(""); setLoading(true);
    try { return await action(); } catch (err) { setError(err.response?.data?.message || err.message || "Request failed"); return null; } finally { setLoading(false); }
  };
  const authenticate = async (values) => {
    const data = await run(() => mode === "login" ? login(values) : register(values));
    if (data) { localStorage.setItem("sparbot_token", data.data.token); setAuthToken(data.data.token); }
  };
  const start = async (values) => {
    const data = await run(() => startAssessment(values));
    if (data) { setAssessment(data.data.assessment); setQuestion(data.data.question); setCode(data.data.question.starterCode?.[values.language] || ""); }
  };
  const ask = async (message) => {
    const data = await run(() => askAssistant(assessment._id, { message, code, interactionType: "DEBUG" }));
    if (data) setInteractions((items) => [...items, { message, reply: data.data.interaction.aiResponse }]);
  };
  const submit = async () => {
    if (!assessment || evaluation || loading) return;
    const data = await run(() => submitAssessment(assessment._id, { code, language: assessment.language }));
    if (data) setEvaluation(data.data.evaluation);
  };
  const signOut = () => { localStorage.removeItem("sparbot_token"); setAuthToken(""); setAssessment(null); };
  const restart = () => { setAssessment(null); setQuestion(null); setCode(""); setInteractions([]); setEvaluation(null); };
  if (!token) return <AuthPage mode={mode} setMode={setMode} onSubmit={authenticate} loading={loading} error={error} />;
  if (!assessment) return <SetupPage onStart={start} onSignOut={signOut} loading={loading} error={error} />;
  if (evaluation) return <ResultPage evaluation={evaluation} onRestart={restart} />;
  return <AssessmentPage assessment={assessment} question={question} code={code} setCode={setCode} language={assessment.language} interactions={interactions} onAsk={ask} onSubmit={submit} loading={loading} error={error} />;
}
