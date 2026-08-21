import axios from "axios";
import { env } from "../config/env.js";
import ExpressError from "../utils/ExpreeError.util.js";

const pistonRuntimes = { python: { language: "python", version: "3.10.0", filename: "main.py" }, cpp: { language: "c++", version: "10.2.0", filename: "main.cpp" }, java: { language: "java", version: "15.0.2", filename: "Main.java" } };
const judge0Languages = { python: 71, cpp: 54, java: 62 };
const endpoint = (path = "") => `${env.runnerUrl.replace(/\/$/, "")}${path}`;
const headers = () => {
  if (!env.runnerApiKey) return undefined;
  return env.runnerProvider === "piston"
    ? { Authorization: `Bearer ${env.runnerApiKey}` }
    : { "X-Auth-Token": env.runnerApiKey };
};

const MAX_ACTIVE_RUNS = 2;
const MAX_QUEUED_RUNS = 12;
let activeRuns = 0;
const waitingRuns = [];

const withRunnerSlot = async (work) => {
  if (activeRuns >= MAX_ACTIVE_RUNS && waitingRuns.length >= MAX_QUEUED_RUNS) {
    throw new ExpressError(429, "The code runner is busy. Please try again in a moment.");
  }
  if (activeRuns >= MAX_ACTIVE_RUNS) await new Promise((resolve) => waitingRuns.push(resolve));
  activeRuns += 1;
  try { return await work(); }
  finally {
    activeRuns -= 1;
    waitingRuns.shift()?.();
  }
};

const unavailable = (error) => {
  if (error.response?.status === 401 || error.response?.status === 403) throw new ExpressError(502, "The code runner rejected this request. Check RUNNER_API_KEY or runner access rules.");
  if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") throw new ExpressError(503, "Code runner is offline. Start the free Judge0 CE service, then try again.");
  throw new ExpressError(502, error.response?.data?.message || "Code runner is unavailable. Try again shortly.");
};

const runWithJudge0 = async ({ code, language, input }) => {
  const languageId = judge0Languages[language];
  if (!languageId) throw new ExpressError(400, "Choose java, python, or cpp");
  try {
    const { data } = await axios.post(`${endpoint("/submissions")}?base64_encoded=false&wait=true`, { source_code: code, language_id: languageId, stdin: input, cpu_time_limit: 2, cpu_extra_time: 0.5, wall_time_limit: 4, memory_limit: 256000, stack_limit: 32768, max_processes_and_or_threads: 32, max_file_size: 256, enable_network: false }, { timeout: 12000, headers: headers() });
    const status = data.status || {};
    if (status.id === 13) {
      throw new ExpressError(503, data.message || "Judge0 could not initialize its execution sandbox. Check the Docker host cgroup support.");
    }
    const stderr = data.compile_output || data.stderr || data.message || "";
    return { stdout: data.stdout || "", stderr, output: data.stdout || stderr, code: status.id === 3 ? 0 : data.exit_code ?? 1, signal: null, timedOut: status.id === 5 || /time limit/i.test(status.description || ""), time: data.time ?? null, memory: data.memory ?? null };
  } catch (error) { return unavailable(error); }
};

const runWithPiston = async ({ code, language, input }) => {
  const runtime = pistonRuntimes[language];
  if (!runtime) throw new ExpressError(400, "Choose java, python, or cpp");
  try {
    const { data } = await axios.post(env.runnerUrl, {
      language: runtime.language,
      version: runtime.version,
      files: [{ name: runtime.filename, content: code }],
      stdin: input,
      compile_timeout: 8000,
      compile_cpu_time: 8000,
      compile_memory_limit: 536870912,
      run_timeout: 4000,
      run_cpu_time: 2000,
      run_memory_limit: 268435456,
    }, { timeout: 15000, headers: headers() });
    const run = data.run || {};
    return { stdout: run.stdout || "", stderr: run.stderr || "", output: run.output || run.stdout || run.stderr || "", code: run.code, signal: run.signal, timedOut: run.signal === "SIGKILL" || /timed? out/i.test(run.stderr || ""), time: run.cpu_time ?? null, memory: run.memory ?? null };
  } catch (error) { return unavailable(error); }
};

const asCase = (item) => {
  if (!item || typeof item !== "object") return null;
  const input = item.input ?? item.stdin ?? item.arguments;
  const expected = item.output ?? item.expectedOutput ?? item.expected;
  return input !== undefined && expected !== undefined ? { input: String(input), expected: String(expected) } : null;
};
export const getTestCases = (question) => {
  // `test` is a Python checker for the imported LeetCode dataset. Standard
  // input/output cases are stored separately in `inputOutput`.
  const raw = Array.isArray(question.test) || typeof question.test === "object"
    ? question.test
    : question.inputOutput ?? [];
  const items = Array.isArray(raw) ? raw : raw.cases ?? raw.testCases ?? [];
  return items.map(asCase).filter(Boolean).slice(0, 20);
};
const normalize = (value) => String(value || "").trim().replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");
const normalizeExpected = (value) => {
  const normalized = normalize(value);
  return /^(true|false)$/i.test(normalized) ? normalized.toLowerCase() : normalized;
};

const matrixLiteralForJava = (value) => {
  if (!/^\s*\[\s*\[/.test(value)) return null;
  try {
    const matrix = JSON.parse(value);
    if (!Array.isArray(matrix) || !matrix.every((row) => Array.isArray(row) && row.every(Number.isInteger))) return null;
    return `{${matrix.map((row) => `{${row.join(",")}}`).join(",")}}`;
  } catch { return null; }
};

const withJavaTestMain = (source, body) => {
  const main = /public\s+static\s+void\s+main\s*\(\s*String\s*\[\]\s+\w+\s*\)\s*\{/.exec(source);
  if (!main) {
    const end = source.lastIndexOf("}");
    return end < 0 ? null : `${source.slice(0, end)}public static void main(String[] args) { ${body} }\n${source.slice(end)}`;
  }
  let depth = 1;
  let index = main.index + main[0].length;
  const bodyStart = index;
  for (; index < source.length && depth > 0; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
  }
  return depth === 0 ? `${source.slice(0, bodyStart)} ${body} ${source.slice(index - 1)}` : null;
};

// Legacy imported tests sometimes look like `mat = [[...]], target = [[...]]`.
// They describe a function call, not process stdin. Adapt the common two-matrix
// static-boolean Java contract so we invoke the candidate method once per case.
const javaMatrixFunctionCase = async ({ code, testCase }) => {
  const match = /^\s*mat\s*=\s*(\[\[.*\]\])\s*,\s*target\s*=\s*(\[\[.*\]\])\s*$/s.exec(testCase.input);
  const classMatch = /(?:public\s+)?class\s+([A-Za-z_]\w*)/.exec(code);
  const methodMatch = /(static\s+)?boolean\s+([A-Za-z_]\w*)\s*\(\s*int\s*\[\]\s*\[\]\s+\w+\s*,\s*int\s*\[\]\s*\[\]\s+\w+\s*\)/.exec(code);
  if (!match || !classMatch || !methodMatch) return null;
  const mat = matrixLiteralForJava(match[1]);
  const target = matrixLiteralForJava(match[2]);
  if (!mat || !target) return null;
  const className = classMatch[1];
  const methodName = methodMatch[2];
  const invocation = methodMatch[1]
    ? `${className}.${methodName}(mat, target)`
    : `new ${className}().${methodName}(mat, target)`;
  const harness = withJavaTestMain(code, `int[][] mat = ${mat}; int[][] target = ${target}; System.out.print(${invocation});`);
  return harness ? runProgram({ code: harness, language: "java" }) : null;
};

const stringLiteralForJava = (value) => {
  try { return JSON.stringify(JSON.parse(value)); } catch { return null; }
};

const javaStringFunctionCase = async ({ code, testCase }) => {
  const match = /^\s*s\s*=\s*("(?:[^"\\]|\\.)*")\s*,\s*t\s*=\s*("(?:[^"\\]|\\.)*")\s*$/s.exec(testCase.input);
  const methodMatch = /(static\s+)?String\s+([A-Za-z_]\w*)\s*\(\s*String\s+\w+\s*,\s*String\s+\w+\s*\)/.exec(code);
  if (!match || !methodMatch) return null;
  const s = stringLiteralForJava(match[1]);
  const t = stringLiteralForJava(match[2]);
  if (!s || !t) return null;
  const methodName = methodMatch[2];
  const hasClass = /(?:public\s+)?class\s+([A-Za-z_]\w*)/.test(code);
  if (!hasClass) {
    const invocation = methodMatch[1] ? `${methodName}(s, t)` : `new Main().${methodName}(s, t)`;
    return runProgram({
      code: `public class Main { ${code}\npublic static void main(String[] args) { String s = ${s}; String t = ${t}; System.out.print(${invocation}); } }`,
      language: "java",
    });
  }
  const className = /(?:public\s+)?class\s+([A-Za-z_]\w*)/.exec(code)[1];
  const invocation = methodMatch[1] ? `${className}.${methodName}(s, t)` : `new ${className}().${methodName}(s, t)`;
  const harness = withJavaTestMain(code, `String s = ${s}; String t = ${t}; System.out.print(${invocation});`);
  return harness ? runProgram({ code: harness, language: "java" }) : null;
};

const functionTestSource = (question) => typeof question.test === "string" && /def\s+check\s*\(\s*candidate\s*\)/.test(question.test)
  ? question.test
  : null;

export const supportedLanguagesForQuestion = () => ["python", "java", "cpp"];

const instrumentPythonAssertions = (source) => source.replace(
  /^(\s*)assert\s+(.+)$/gm,
  (_, indent, expression) => `${indent}try:\n${indent}    assert ${expression}\n${indent}    __sparbot_record(True)\n${indent}except Exception:\n${indent}    __sparbot_record(False)`,
);

const runPythonFunctionTests = async ({ code, question }) => {
  const source = functionTestSource(question);
  if (!source) return null;
  const entryPoint = question.entryPoint || "Solution()";
  const harness = `from typing import *
class ListNode:
    def __init__(self, val=0, next=None):
        self.val, self.next = val, next
__sparbot_passed = 0
__sparbot_total = 0
def __sparbot_record(passed):
    global __sparbot_passed, __sparbot_total
    __sparbot_total += 1
    __sparbot_passed += int(bool(passed))
${code}
${instrumentPythonAssertions(source)}
try:
    check(${entryPoint})
    print(f"__SPARBOT_RESULT__:{__sparbot_passed}:{__sparbot_total}")
except Exception as error:
    print(f"__SPARBOT_ERROR__:{type(error).__name__}: {error}")`;
  const result = await runProgram({ code: harness, language: "python" });
  const match = result.stdout.match(/__SPARBOT_RESULT__:(\d+):(\d+)/);
  const error = result.stdout.match(/__SPARBOT_ERROR__:(.+)/)?.[1] || result.stderr;
  if (!match) {
    return {
      available: true, total: 0, passed: 0, tests: [],
      message: error || "The submitted code could not be evaluated against this question's test suite.",
    };
  }
  const passed = Number(match[1]);
  const total = Number(match[2]);
  return {
    available: true,
    total,
    passed,
    tests: [{ passed: passed === total, timedOut: result.timedOut, time: result.time, memory: result.memory }],
    message: `${passed}/${total} hidden database test cases passed.`,
  };
};

export const runProgram = async ({ code, language, input = "" }) => {
  if (!code?.trim()) throw new ExpressError(400, "Code is required");
  if (code.length > 50_000) throw new ExpressError(400, "Code must be under 50 KB");
  if (!env.runnerUrl) throw new ExpressError(503, "Set RUNNER_API_URL to your Judge0 CE service.");
  const request = { code, language, input: String(input).slice(0, 10_000) };
  return withRunnerSlot(() => env.runnerProvider === "piston" ? runWithPiston(request) : runWithJudge0(request));
};
export const runAgainstTests = async ({ code, language, question }) => {
  const cases = getTestCases(question);
  if (language === "java" && !/(?:public\s+)?class\s+[A-Za-z_]\w*/.test(code)
    && !/\bpublic\s+(?:static\s+)?(?:boolean|int|long|double|String|List\s*<[^>]+>)\s+[A-Za-z_]\w*\s*\(/.test(code)) {
    return {
      available: false,
      total: 0,
      passed: 0,
      tests: [],
      message: "Java LeetCode submissions may omit main(), but they must include the public problem method (for example, public int minTransfers(...)). This submission contains only private helper methods.",
    };
  }
  if (!cases.length && functionTestSource(question) && language === "python") {
    return runPythonFunctionTests({ code, question });
  }
  if (!cases.length) return {
    available: false,
    total: 0,
    passed: 0,
    tests: [],
    message: "This question needs language-neutral stdin/stdout test cases before it can be evaluated in Java or C++.",
  };
  const tests = [];
  for (const testCase of cases) {
    const adapted = language === "java"
      ? await javaMatrixFunctionCase({ code, testCase }) || await javaStringFunctionCase({ code, testCase })
      : null;
    const result = adapted || await runProgram({ code, language, input: testCase.input });
    tests.push({ input: testCase.input, expected: testCase.expected, output: result.output, passed: result.code === 0 && normalizeExpected(result.stdout) === normalizeExpected(testCase.expected), stderr: result.stderr, timedOut: result.timedOut, time: result.time, memory: result.memory });
  }
  return { available: true, total: tests.length, passed: tests.filter((test) => test.passed).length, tests };
};
