# Safe local code execution with Piston

Sparbot runs Python, C++, and Java in Piston's `isolate` sandbox. Submitted code never runs in the Express process. Piston supports cgroup v2, which Docker Desktop on Windows provides.

- Each program run is limited to 2 CPU seconds, 4 seconds of wall time, 256 MB memory, 32 processes/threads, and 256 KB of generated files/output. Compilation has an 8-second, 512 MB allowance.
- The Piston container is capped at 2 CPUs, 2 GB RAM, and 256 PIDs; only two programs may execute at once.
- The backend admits only two active runner requests and up to twelve waiting requests. Additional requests receive HTTP 429 rather than overloading the machine.

Piston needs Docker/Compose and cgroup v2, and is compatible with Docker Desktop on Windows.

## Start the runner

1. Start the service from the `.piston` folder:

```powershell
docker compose up -d
```

2. Add these values to `server/.env`, then restart the API:

```env
RUNNER_PROVIDER=piston
RUNNER_API_URL=http://localhost:2000/api/v2/execute
RUNNER_API_KEY=
```

Piston is bound to `127.0.0.1`, so it is not exposed to other machines. For a production deployment, keep that network boundary or place it on a private Docker network behind the API.

## Host sizing

Leave at least 2 CPU cores and 2 GB RAM for the operating system and your editor/browser. In Docker Desktop, give Docker at least 3 GB memory. If the host is smaller, lower the Piston container's CPU and memory limits together.

The limits intentionally favor short assessment-style programs. Raise them only for a specific exercise after considering the number of concurrent executions.
