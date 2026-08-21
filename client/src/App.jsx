import { useEffect, useState } from "react";
import "./App.css";
import { setToken } from "./services/api";
import { login, register } from "./services/auth.service";
import { askAssistant, getAssessment, runCode, runTests, startAssessment, submitAssessment } from "./services/assessment.service";
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
  const [language, setLanguage] = useState("python");
  const [interactions, setInteractions] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [runResult, setRunResult] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => setToken(token), [token]);
  useEffect(() => {
    const assessmentId = localStorage.getItem("sparbot_active_assessment");
    if (!token || !assessmentId || assessment) return;
    getAssessment(assessmentId).then((data) => {
      const saved = JSON.parse(localStorage.getItem(`sparbot_draft_${assessmentId}`) || "{}");
      setAssessment(data.data.assessment); setQuestion(data.data.question);
      setLanguage(saved.language || data.data.assessment.language);
      setCode(saved.code ?? data.data.assessment.finalCode ?? data.data.question.starterCode?.[saved.language || data.data.assessment.language] ?? ""); setRunResult(saved.runResult || null);
      setInteractions((data.data.interactions || []).map((item) => ({ message: item.userMessage, reply: item.aiResponse, suggestedCode: item.suggestedCode })));
    }).catch(() => localStorage.removeItem("sparbot_active_assessment"));
  }, [token, assessment]);
  useEffect(() => {
    if (assessment) localStorage.setItem(`sparbot_draft_${assessment._id}`, JSON.stringify({ code, language, runResult }));
  }, [assessment, code, language, runResult]);
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
    if (data) { localStorage.setItem("sparbot_active_assessment", data.data.assessment._id); setAssessment(data.data.assessment); setQuestion(data.data.question); setLanguage(data.data.assessment.language); setCode(data.data.question.starterCode?.[values.language] || ""); setRunResult(null); }
  };
  const execute = async (input) => {
    const data = await run(() => runCode(assessment._id, { code, language, input }));
    if (data) setRunResult(data.data.result);
  };
  const executeTests = async () => {
    const data = await run(() => runTests(assessment._id, { code, language }));
    if (data) setTestResult(data.data.result);
  };
  const ask = async (message) => {
    const data = await run(() => askAssistant(assessment._id, { message, code, language, interactionType: "DEBUG" }));
    if (data) setInteractions((items) => [...items, { message, reply: data.data.interaction.aiResponse, suggestedCode: data.data.interaction.suggestedCode }]);
  };
  const submit = async (autoSubmit = false) => {
    if (!assessment || evaluation || loading) return;
    const data = await run(() => submitAssessment(assessment._id, { code, language, autoSubmit }));
    if (data) { localStorage.removeItem("sparbot_active_assessment"); localStorage.removeItem(`sparbot_draft_${assessment._id}`); setEvaluation(data.data.evaluation); }
  };
  const signOut = () => { localStorage.removeItem("sparbot_token"); setAuthToken(""); setAssessment(null); };
  const changeLanguage = (nextLanguage) => { setLanguage(nextLanguage); setRunResult(null); setTestResult(null); setCode(question.starterCode?.[nextLanguage] || ""); };
  const restart = () => { setAssessment(null); setQuestion(null); setCode(""); setInteractions([]); setEvaluation(null); setRunResult(null); setTestResult(null); };
  if (!token) return <AuthPage mode={mode} setMode={setMode} onSubmit={authenticate} loading={loading} error={error} />;
  if (!assessment) return <SetupPage onStart={start} onSignOut={signOut} loading={loading} error={error} />;
  if (evaluation) return <ResultPage evaluation={evaluation} onRestart={restart} />;
  return <AssessmentPage assessment={assessment} question={question} code={code} setCode={setCode} language={language} onLanguageChange={changeLanguage} interactions={interactions} onAsk={ask} onApplyCode={setCode} onRun={execute} onRunTests={executeTests} runResult={runResult} testResult={testResult} onSubmit={() => submit(false)} onExit={() => submit(true)} loading={loading} error={error} />;
}
