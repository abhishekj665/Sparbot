export default function ResultPage({ evaluation, onRestart }) {
  const testResults = evaluation.aiAnalysis?.testResults;
  const fullyAccepted = testResults?.available && testResults.total > 0 && testResults.passed === testResults.total;
  return (
    <main className="result">
      <h1>{fullyAccepted && evaluation.result === "PASS" ? "Accepted" : evaluation.result === "PASS" ? "Completed" : "Needs review"}</h1>
      {testResults?.available && <p className="acceptance-rate">{evaluation.codeScore}% correct · {testResults.passed}/{testResults.total} test cases passed</p>}
      <p className="score">{evaluation.finalScore}/100</p>
      <p>{evaluation.aiAnalysis?.summary || "Your assessment is complete."}</p>
      <section className="test-results"><h2>Database test cases</h2><p>{testResults?.message || (testResults?.available ? "Test results recorded." : "No database test cases were executed.")}</p>{testResults?.tests?.filter((test) => test.input !== undefined).map((test, index) => <article className={test.passed ? "test-case passed" : "test-case failed"} key={index}><b>Case {index + 1}: {test.passed ? "Passed" : test.timedOut ? "Time limit exceeded" : "Failed"}</b><span>Input: <code>{test.input || "(empty)"}</code></span><span>Expected: <code>{test.expected}</code></span>{!test.passed && <span>Output: <code>{test.output || test.stderr || "(no output)"}</code></span>}{test.time != null && <span>Runtime: {test.time}s{test.memory != null && ` · Memory: ${test.memory} KB`}</span>}</article>)}</section>
      <div className="scores">
        <span>Database correctness {evaluation.codeScore}%</span>
        <span>Assessment process {evaluation.aiScore}%</span>
        <span>Efficiency {evaluation.aiAnalysis?.efficiencyScore ?? 0}%</span>
        <span>Time complexity {evaluation.aiAnalysis?.timeComplexity || "Not available"}</span>
      </div>
      <button onClick={onRestart}>Take another assessment</button>
    </main>
  );
}
