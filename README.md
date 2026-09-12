# Sparbot

Sparbot is a Java-only coding-assessment app. A candidate receives a problem, works through a guided discussion, writes Java code, runs it in a protected local runner, and submits it for evaluation.

## Why Sparbot exists

Coding interviews and online assessments can feel difficult for beginners because they test more than typing code: candidates must understand the problem, choose data structures, explain an approach, handle edge cases, and test their work under time pressure. At the same time, general-purpose coding assistants can reveal too much too early, which makes it harder to practise the reasoning an assessment is meant to measure.

Sparbot was built as a safe place to practise that process. Its assistant follows a structured sequence: describe the problem, justify data structures, explain the algorithm and complexity, receive starter code based on that explanation, then request specific refinements. It does not jump directly to a complete answer.

## How learners can use it

Use Sparbot as a personal AI-assisted coding-assessment practice tool:

1. Create an account and choose a difficulty.
2. Read the problem, then open the coding assistant and explain the inputs, outputs, constraints, and an edge case in your own words.
3. Continue through the data-structure and approach questions before using the Java starter code in the editor.
4. Write and test your own Java solution. The runner executes code in a separate local container rather than in the web server.
5. Submit the assessment to review test results and feedback, then restart with another problem.

The included starter questions are for learning and local testing. You can add your own questions to MongoDB to practise a specific topic, interview pattern, or difficulty level.

This guide is written for someone starting the project on a new Windows computer. You do not need to understand the code to follow it.

## What you need before starting

Install these free tools first:

- [Git](https://git-scm.com/downloads) — downloads the project.
- [Node.js 20 or newer](https://nodejs.org/) — runs the website and API.
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — safely runs submitted Java code. Open it after installation and wait until it says **Engine running**.
- A MongoDB database. The simplest option is a free [MongoDB Atlas](https://www.mongodb.com/atlas/database) cluster. Copy its connection string when it is created.

You also need a [Groq API key](https://console.groq.com/keys) for the assessment assistant. A Gemini API key is optional; it adds a short code-quality review after submission.

## 1. Download the project

Open PowerShell, choose a folder where you keep projects, then run:

```powershell
git clone YOUR_REPOSITORY_URL
cd Sparbot
```

Replace `YOUR_REPOSITORY_URL` with the Clone URL from your GitHub repository. If the downloaded folder has a different name, use that name in the second command.

## 2. Install the project packages

Run these commands from the project folder:

```powershell
cd server
npm install
cd ..\client
npm install
cd ..
```

This can take a few minutes the first time.

## 3. Create your private settings file

Create a local settings file from the safe example:

```powershell
Copy-Item server\.env.example server\.env
notepad server\.env
```

Fill in these values and save the file:

```env
PORT=3000
MONGODB_URI=your MongoDB Atlas connection string
TOKEN_SECRET=any long random private phrase
GROQ_API_KEY=your Groq API key
GROQ_MODEL=openai/gpt-oss-120b
GEMINI_API_KEY=
RUNNER_PROVIDER=piston
RUNNER_API_URL=http://localhost:2000/api/v2/execute
RUNNER_API_KEY=
CLIENT_URL=http://localhost:5173
```

Keep `server/.env` private. It is already excluded from Git, so API keys and database passwords are not uploaded when you push the project.

## 4. Start the Java code runner

Make sure Docker Desktop is open and its engine is running. Then, in PowerShell:

```powershell
cd .piston
docker compose up -d
```

Piston starts without programming languages installed on a fresh machine. Install Java only:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:2000/api/v2/packages -ContentType "application/json" -Body '{"language":"java","version":"*"}'
```

Wait for the command to finish, then confirm Java is available:

```powershell
Invoke-RestMethod http://localhost:2000/api/v2/runtimes | Where-Object language -eq "java"
```

You should see Java in the result. Piston stores this installation in Docker, so you normally do this only once. Piston’s official documentation explains that runtimes are installed separately from the API container: [Piston setup guide](https://github.com/engineer-man/piston#installation).

## 5. Add sample assessment questions

Return to the `server` folder and run:

```powershell
cd ..\server
npm run seed
```

This adds three small Java-compatible questions (Easy, Medium, and Hard) to your database. It is safe to run again; it updates only Sparbot’s starter questions.

## 6. Start the app

Keep three PowerShell windows open.

In the first window, start the Java runner if it is not already running:

```powershell
cd D:\path\to\Sparbot\.piston
docker compose up -d
```

In the second window, start the backend:

```powershell
cd D:\path\to\Sparbot\server
npm run dev
```

Wait until you see `Database ready` and `Server listening on port 3000`.

In the third window, start the website:

```powershell
cd D:\path\to\Sparbot\client
npm run dev
```

Open the URL shown by Vite, normally [http://localhost:5173](http://localhost:5173), in your browser. Create an account, select a difficulty, and start an assessment.

## Quick health check

If the page opens but something does not work, check these addresses in your browser:

- [http://localhost:3000/api/health](http://localhost:3000/api/health) should report that the API is running.
- [http://localhost:2000/api/v2/runtimes](http://localhost:2000/api/v2/runtimes) should include Java.
