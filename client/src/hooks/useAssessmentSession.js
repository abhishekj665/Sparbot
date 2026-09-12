import { useEffect, useState } from "react";
import { setToken } from "../services/api";
import { login, register } from "../services/auth.service";
import {
  askAssistant,
  getAssessment,
  runCode,
  runTests,
  startAssessment,
  submitAssessment,
} from "../services/assessment.service";
import { isJavaSource, starterCodeFor } from "../utils/javaStarter";

export function useAssessmentSession() {
  const [token, setAuthToken] = useState(
    () => localStorage.getItem("sparbot_token") || "",
  );
  const [mode, setMode] = useState("login");
  const [assessment, setAssessment] = useState(null);
  const [question, setQuestion] = useState(null);
  const [code, setCode] = useState("");
  const [language] = useState("java");
  const [interactions, setInteractions] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [runResult, setRunResult] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Working...");
  const [restoringAssessment, setRestoringAssessment] = useState(() =>
    Boolean(
      localStorage.getItem("sparbot_token") &&
      localStorage.getItem("sparbot_active_assessment"),
    ),
  );
  const notify = (message, type = "error") => setToast({ message, type });
  const request = async (action, message) => {
    setError("");
    setLoadingMessage(message);
    setLoading(true);
    try {
      return await action();
    } catch (err) {
      const problem =
        err.response?.data?.message ||
        err.message ||
        "Something went wrong. Please try again.";
      setError(problem);
      notify(problem);
      return null;
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => setToken(token), [token]);
  useEffect(() => {
    const assessmentId = localStorage.getItem("sparbot_active_assessment");
    if (!token || !assessmentId || assessment) return;
    getAssessment(assessmentId)
      .then((data) => {
        const saved = JSON.parse(
          localStorage.getItem(`sparbot_draft_${assessmentId}`) || "{}",
        );
        setAssessment(data.data.assessment);
        setQuestion(data.data.question);
        const restoredCode = saved.code ?? data.data.assessment.finalCode;
        setCode(
          isJavaSource(restoredCode)
            ? restoredCode
            : starterCodeFor(data.data.question),
        );
        setRunResult(saved.runResult || null);
        setInteractions(
          (data.data.interactions || []).map((item) => ({
            message: item.userMessage,
            reply: item.aiResponse,
            suggestedCode: item.suggestedCode,
          })),
        );
      })
      .catch(() => localStorage.removeItem("sparbot_active_assessment"))
      .finally(() => setRestoringAssessment(false));
  }, [token, assessment]);
  useEffect(() => {
    if (assessment)
      localStorage.setItem(
        `sparbot_draft_${assessment._id}`,
        JSON.stringify({ code, language, runResult }),
      );
  }, [assessment, code, language, runResult]);
  const authenticate = async (values) => {
    const data = await request(
      () => (mode === "login" ? login(values) : register(values)),
      mode === "login" ? "Signing you in..." : "Creating your account...",
    );
    if (data) {
      localStorage.setItem("sparbot_token", data.data.token);
      setAuthToken(data.data.token);
    }
  };
  const start = async (values) => {
    const data = await request(
      () => startAssessment(values),
      "Creating your AI-generated Java starter code...",
    );
    if (data) {
      localStorage.setItem(
        "sparbot_active_assessment",
        data.data.assessment._id,
      );
      setAssessment(data.data.assessment);
      setQuestion(data.data.question);
      setCode(starterCodeFor(data.data.question));
      setRunResult(null);
      setTestResult(null);
      notify("Assessment started. Your Java starter code is ready.", "success");
    }
  };
  const execute = async (input) => {
    if (!code.trim()) return notify("Add Java code before running it.");
    const data = await request(
      () => runCode(assessment._id, { code, language, input }),
      "Running your Java code...",
    );
    if (data) {
      setRunResult(data.data.result);
      notify(
        data.data.result.code === 0
          ? "Code ran successfully."
          : data.data.result.output || "Your code could not compile or run.",
        data.data.result.code === 0 ? "success" : "error",
      );
    }
  };
  const executeTests = async () => {
    if (!code.trim()) return notify("Add Java code before running tests.");
    const data = await request(
      () => runTests(assessment._id, { code, language }),
      "Running test cases...",
    );
    if (data) {
      setTestResult(data.data.result);
      const { passed, total, message } = data.data.result;
      notify(
        message || `${passed}/${total} test cases passed.`,
        passed === total && total > 0 ? "success" : "error",
      );
    }
  };
  const ask = async (message) => {
    const data = await request(
      () =>
        askAssistant(assessment._id, {
          message,
          code,
          language,
          interactionType: "DEBUG",
        }),
      "AI assistant is thinking...",
    );
    if (data) {
      setAssessment((current) => ({
        ...current,
        assistantStage: data.data.interaction.assessmentStage,
      }));
      setInteractions((items) => [
        ...items,
        {
          message,
          reply: data.data.interaction.aiResponse,
          suggestedCode: data.data.interaction.suggestedCode,
        },
      ]);
    }
  };
  const submit = async (autoSubmit = false) => {
    if (!assessment || evaluation || loading) return;
    if (!autoSubmit && !code.trim())
      return notify("Add Java code before submitting your assessment.");
    const data = await request(
      () => submitAssessment(assessment._id, { code, language, autoSubmit }),
      "Submitting and evaluating your solution...",
    );
    if (data) {
      localStorage.removeItem("sparbot_active_assessment");
      localStorage.removeItem(`sparbot_draft_${assessment._id}`);
      setEvaluation(data.data.evaluation);
    }
  };
  const signOut = () => {
    localStorage.removeItem("sparbot_token");
    setAuthToken("");
    setAssessment(null);
  };
  const restart = () => {
    setAssessment(null);
    setQuestion(null);
    setCode("");
    setInteractions([]);
    setEvaluation(null);
    setRunResult(null);
    setTestResult(null);
  };
  return {
    token,
    mode,
    setMode,
    assessment,
    question,
    code,
    setCode,
    language,
    interactions,
    evaluation,
    runResult,
    testResult,
    error,
    toast,
    setToast,
    loading,
    loadingMessage,
    restoringAssessment,
    authenticate,
    start,
    execute,
    executeTests,
    ask,
    submit,
    signOut,
    restart,
  };
}
