export default function ResultPage({ evaluation, onRestart }) {
  return (
    <main className="result">
      <h1>{evaluation.result}</h1>
      <p className="score">{evaluation.finalScore}/100</p>
      <p>{evaluation.aiAnalysis?.summary || "Your assessment is complete."}</p>
      <div className="scores">
        <span>Code {evaluation.codeScore}</span>
        <span>AI usage {evaluation.aiScore}</span>
        <span>Problem solving {evaluation.problemSolvingScore}</span>
        <span>Time {evaluation.timeScore}</span>
      </div>
      <button onClick={onRestart}>Take another assessment</button>
    </main>
  );
}
