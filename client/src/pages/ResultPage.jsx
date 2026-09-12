const resultLabel = (testResults) => {
  if (!testResults?.available) return "Submission complete";
  return testResults.passed === testResults.total && testResults.total > 0
    ? "Accepted"
    : "Wrong answer";
};

export default function ResultPage({ evaluation, code, onRestart }) {
  const testResults = evaluation.aiAnalysis?.testResults;
  const total = testResults?.total || 0;
  const passed = testResults?.passed || 0;
  const percentage =
    testResults?.available && total > 0
      ? Math.round((passed / total) * 100)
      : 0;
  const firstFailure = testResults?.tests?.find((test) => !test.passed);
  const accepted = testResults?.available && total > 0 && passed === total;

  return (
    <main className="result-page">
      <section className="submission-result">
        <p
          className={
            accepted
              ? "submission-status accepted"
              : "submission-status rejected"
          }
        >
          {resultLabel(testResults)}
        </p>
        <div className="submission-summary">
          <strong>{percentage}%</strong>
          <span>
            {testResults?.available
              ? `${passed} / ${total} test cases passed`
              : "No test result available"}
          </span>
        </div>
        <div
          className="pass-track"
          aria-label={`${percentage}% of test cases passed`}
        >
          <span style={{ width: `${percentage}%` }} />
        </div>
        <p className="submission-note">
          {accepted
            ? "All test cases passed. Great work!"
            : firstFailure
              ? "Showing the first failing test case so you can focus on the next fix."
              : testResults?.message || "Your assessment is complete."}
        </p>
      </section>
      {firstFailure && (
        <section className="failure-card" aria-label="First failing test case">
          <h2>
            {firstFailure.timedOut
              ? "Time limit exceeded"
              : "First failing test case"}
          </h2>
          <div>
            <span>Input</span>
            <code>{firstFailure.input || "(empty)"}</code>
          </div>
          <div>
            <span>Expected</span>
            <code>{firstFailure.expected ?? "(no expected output)"}</code>
          </div>
          <div>
            <span>Your output</span>
            <code>
              {firstFailure.output || firstFailure.stderr || "(no output)"}
            </code>
          </div>
        </section>
      )}
      <section className="result-details">
        <span>
          Language <b>Java</b>
        </span>
        <span>
          Assessment score <b>{evaluation.finalScore}/100</b>
        </span>
        <span>
          Time complexity{" "}
          <b>{evaluation.aiAnalysis?.timeComplexity || "Not available"}</b>
        </span>
      </section>
      {code && (
        <section className="submitted-code">
          <div>
            <span>Code</span>
            <b>Java</b>
          </div>
          <pre>
            <code>{code}</code>
          </pre>
        </section>
      )}
      <button type="button" className="restart-button" onClick={onRestart}>
        Take another assessment
      </button>
    </main>
  );
}
