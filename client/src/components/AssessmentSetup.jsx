import { useState } from "react";

export default function AssessmentSetup({ onStart, loading }) {
  const [difficulty, setDifficulty] = useState("Easy");
  return (
    <section className="setup-card">
      <h2>Start your assessment</h2>
      <p>Choose a difficulty. This assessment uses Java.</p>
      <label>
        Difficulty
        <select
          value={difficulty}
          onChange={(event) => setDifficulty(event.target.value)}
        >
          <option>Easy</option>
          <option>Medium</option>
          <option>Hard</option>
        </select>
      </label>
      <button
        type="button"
        disabled={loading}
        onClick={() => onStart({ difficulty })}
      >
        Start assessment
      </button>
    </section>
  );
}
