import axios from "axios";
import { env } from "../config/env.js";
import ExpressError from "../utils/ExpreeError.util.js";

const pistonRuntimes = { java: { language: "java", version: "15.0.2", filename: "Main.java" } };
const headers = () => {
  if (!env.runnerApiKey) return undefined;
  return { Authorization: `Bearer ${env.runnerApiKey}` };
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
  if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") throw new ExpressError(503, "Code runner is offline. Start the Piston service, then try again.");
  throw new ExpressError(502, error.response?.data?.message || "Code runner is unavailable. Try again shortly.");
};

const runWithPiston = async ({ code, language, input }) => {
  const runtime = pistonRuntimes[language];
  if (!runtime) throw new ExpressError(400, "Java is the only supported language");
  try {
    const { data } = await axios.post(env.runnerUrl, {
      language: runtime.language,
      version: runtime.version,
      files: [{ name: runtime.filename, content: code }],
      stdin: input,
      compile_timeout: 8000,
      compile_cpu_time: 8000,
      compile_memory_limit: 536870912,
      run_timeout: 8000,
      run_cpu_time: 8000,
      run_memory_limit: 268435456,
    }, { timeout: 15000, headers: headers() });
    // Piston returns compilation failures under `compile`, with no `run`
    // object. Preserve that output so the editor and test API never show a
    // misleading blank result for a Java compiler error.
    const execution = data.run || data.compile || {};
    const stderr = execution.stderr || data.compile?.stderr || "";
    return {
      stdout: execution.stdout || "",
      stderr,
      output: execution.output || execution.stdout || stderr || "",
      code: execution.code,
      signal: execution.signal,
      timedOut: execution.signal === "SIGKILL" || /timed? out/i.test(stderr),
      time: execution.cpu_time ?? null,
      memory: execution.memory ?? null,
    };
  } catch (error) { return unavailable(error); }
};

const asCase = (item) => {
  if (!item || typeof item !== "object") return null;
  const input = item.input ?? item.stdin ?? item.arguments;
  const expected = item.output ?? item.expectedOutput ?? item.expected;
  return input !== undefined && expected !== undefined ? { input: String(input), expected: String(expected) } : null;
};
export const getTestCases = (question) => {
  // Standard input/output cases may be stored in either test or inputOutput.
  const raw = Array.isArray(question.test) || typeof question.test === "object"
    ? question.test
    : question.inputOutput ?? [];
  const items = Array.isArray(raw) ? raw : raw.cases ?? raw.testCases ?? [];
  return items.map(asCase).filter(Boolean).slice(0, 20);
};
const normalize = (value) => String(value || "")
  .trim()
  .replace(/\r\n/g, "\n")
  .replace(/[ \t]+/g, " ")
  .replace(/\s*([,\[\]])\s*/g, "$1");
const normalizeExpected = (value) => {
  const normalized = normalize(value);
  return /^(true|false)$/i.test(normalized) ? normalized.toLowerCase() : normalized;
};

const cleanJavaSource = (source) => String(source || "")
  .replace(/^\s*```[A-Za-z0-9_-]*\s*$/gm, "")
  .trim();

const wrapBareJavaSolution = (source) => {
  if (/(?:public\s+)?class\s+Solution\b/.test(source)) return source;
  const imports = [...source.matchAll(/^\s*import\s+[^;]+;\s*$/gm)];
  if (!imports.length) return `class Solution {\n${source}\n}`;
  const lastImport = imports.at(-1);
  const afterImports = lastImport.index + lastImport[0].length;
  return `${source.slice(0, afterImports)}\nclass Solution {\n${source.slice(afterImports)}\n}`;
};

const matrixLiteralForJava = (value) => {
  if (!/^\s*\[\s*\[/.test(value)) return null;
  try {
    const matrix = JSON.parse(value);
    if (!Array.isArray(matrix) || !matrix.every((row) => Array.isArray(row) && row.every(Number.isInteger))) return null;
    return `{${matrix.map((row) => `{${row.join(",")}}`).join(",")}}`;
  } catch { return null; }
};

const withJavaTestMain = (source, body, helpers = "") => {
  const main = /public\s+static\s+void\s+main\s*\(\s*String\s*\[\]\s+\w+\s*\)\s*\{/.exec(source);
  if (!main) {
    const solutionSource = source.replace(/\bpublic\s+class\s+Solution\b/, "class Solution");
    if (!/\bclass\s+Solution\b/.test(solutionSource)) return null;
    // Piston's Java runtime chooses the first class in the file to launch.
    // Keep imports first (Java requires that), then emit our generated Main
    // before Solution so a user never has to provide a main method.
    const importBlock = /^(?:\s*import\s+[^;]+;\s*)*/.exec(solutionSource)?.[0] || "";
    const solutionBody = solutionSource.slice(importBlock.length);
    return `${importBlock}\npublic class Main { ${helpers} public static void main(String[] args) { ${body} } }\n${solutionBody}`;
  }
  let depth = 1;
  let index = main.index + main[0].length;
  const bodyStart = index;
  for (; index < source.length && depth > 0; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
  }
  return depth === 0
    ? `${source.slice(0, main.index)} ${helpers} ${source.slice(main.index, bodyStart)} ${body} ${source.slice(index - 1)}`
    : null;
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

const splitNamedArguments = (input) => {
  const matches = [...String(input).matchAll(/(?:^|,\s*)([A-Za-z_]\w*)\s*=/g)];
  if (!matches.length) return [{ name: null, value: String(input).trim() }];
  return matches.map((match, index) => ({
    name: match[1],
    value: input.slice(match.index + match[0].length, matches[index + 1]?.index ?? input.length).replace(/,\s*$/, "").trim(),
  }));
};

const javaLiteralForType = (type, value) => {
  const normalizedType = type.replace(/\s+/g, " ").trim();
  if (/^(int|long|double|boolean)$/.test(normalizedType) && /^(?:-?\d+(?:\.\d+)?|true|false)$/i.test(value)) return value;
  if (normalizedType === "String") return stringLiteralForJava(value);
  if (normalizedType === "int[]") {
    try { const values = JSON.parse(value); return Array.isArray(values) && values.every(Number.isInteger) ? `new int[]{${values.join(",")}}` : null; } catch { return null; }
  }
  if (normalizedType === "String[]") {
    try { const values = JSON.parse(value); return Array.isArray(values) && values.every((item) => typeof item === "string") ? `new String[]{${values.map(JSON.stringify).join(",")}}` : null; } catch { return null; }
  }
  if (normalizedType === "int[][]") return matrixLiteralForJava(value) ? `new int[][]${matrixLiteralForJava(value)}` : null;
  if (normalizedType === "TreeNode") {
    if (/^\s*null\s*$/i.test(value)) return "null";
    try {
      const values = JSON.parse(value);
      if (!Array.isArray(values) || !values.every((item) => item === null || Number.isInteger(item))) return null;
      return `treeFromLevelOrder(new Integer[]{${values.map((item) => item === null ? "null" : item).join(",")}})`;
    } catch { return null; }
  }
  return null;
};

const treeNodeDefinition = `class TreeNode {
  int val;
  TreeNode left;
  TreeNode right;
  TreeNode(int val) { this.val = val; }
}`;

const treeBuilder = `private static TreeNode treeFromLevelOrder(Integer[] values) {
  if (values.length == 0 || values[0] == null) return null;
  TreeNode root = new TreeNode(values[0]);
  java.util.Queue<TreeNode> queue = new java.util.ArrayDeque<>();
  queue.add(root);
  int index = 1;
  while (!queue.isEmpty() && index < values.length) {
    TreeNode node = queue.remove();
    if (index < values.length && values[index] != null) {
      node.left = new TreeNode(values[index]);
      queue.add(node.left);
    }
    index++;
    if (index < values.length && values[index] != null) {
      node.right = new TreeNode(values[index]);
      queue.add(node.right);
    }
    index++;
  }
  return root;
}`;

const javaLeetCodeFunctionCase = async ({ code, testCase }) => {
  if (/public\s+static\s+void\s+main\s*\(/.test(code)) return null;
  code = wrapBareJavaSolution(code);
  const classMatch = /(?:public\s+)?class\s+Solution\b/.exec(code);
  const methodMatch = /public\s+(?:static\s+)?([A-Za-z_]\w*(?:\s*<[^>]+>)?(?:\s*\[\])?)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/.exec(code);
  const inputs = splitNamedArguments(testCase.input);
  if (!classMatch || !methodMatch || !inputs) return null;
  const parameters = methodMatch[3].split(",").map((parameter) => parameter.trim()).filter(Boolean).map((parameter) => {
    const match = /^(.+?)\s+([A-Za-z_]\w*)$/.exec(parameter);
    return match ? { type: match[1], name: match[2] } : null;
  });
  if (parameters.length !== inputs.length || parameters.some((parameter) => !parameter)) return null;
  const declarations = parameters.map((parameter, index) => {
    const literal = javaLiteralForType(parameter.type, inputs[index].value);
    return literal === null ? null : `${parameter.type} ${parameter.name} = ${literal};`;
  });
  if (declarations.some((declaration) => declaration === null)) return null;
  const usesTreeNode = parameters.some((parameter) => parameter.type.replace(/\s+/g, "") === "TreeNode");
  // LeetCode supplies TreeNode implicitly. The editor source normally does
  // not, so add the compatible definition only to this temporary test file.
  const sourceWithTreeNode = usesTreeNode && !/\bclass\s+TreeNode\b/.test(code)
    ? `${code}\n${treeNodeDefinition}`
    : code;
  const invocation = /public\s+static\s+/.test(methodMatch[0])
    ? `Solution.${methodMatch[2]}(${parameters.map((parameter) => parameter.name).join(", ")})`
    : `new Solution().${methodMatch[2]}(${parameters.map((parameter) => parameter.name).join(", ")})`;
  const returnType = methodMatch[1].replace(/\s+/g, "");
  const printableResult = returnType === "int[][]" || returnType === "String[][]"
    ? `java.util.Arrays.deepToString(${invocation})`
    : returnType.endsWith("[]")
      ? `java.util.Arrays.toString(${invocation})`
      : invocation;
  const harness = withJavaTestMain(
    sourceWithTreeNode,
    `${declarations.join(" ")} System.out.print(${printableResult});`,
    usesTreeNode ? treeBuilder : "",
  );
  return harness ? runProgram({ code: harness, language: "java" }) : null;
};

export const supportedLanguagesForQuestion = () => ["java"];

export const runProgram = async ({ code, language, input = "" }) => {
  const cleanCode = cleanJavaSource(code);
  if (!cleanCode) throw new ExpressError(400, "Code is required");
  if (cleanCode.length > 50_000) throw new ExpressError(400, "Code must be under 50 KB");
  if (!env.runnerUrl) throw new ExpressError(503, "Set RUNNER_API_URL to your Piston service.");
  const request = { code: cleanCode, language, input: String(input).slice(0, 10_000) };
  return withRunnerSlot(() => runWithPiston(request));
};
export const runAgainstTests = async ({ code, language, question }) => {
  code = cleanJavaSource(code);
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
  if (!cases.length) return {
    available: false,
    total: 0,
    passed: 0,
    tests: [],
    message: "This question needs Java-compatible stdin/stdout test cases before it can be evaluated.",
  };
  const tests = [];
  for (const testCase of cases) {
    const adapted = language === "java"
      ? await javaLeetCodeFunctionCase({ code, testCase }) || await javaMatrixFunctionCase({ code, testCase }) || await javaStringFunctionCase({ code, testCase })
      : null;
    const result = adapted || await runProgram({ code, language, input: testCase.input });
    tests.push({ input: testCase.input, expected: testCase.expected, output: result.output, stdout: result.stdout, passed: result.code === 0 && normalizeExpected(result.stdout) === normalizeExpected(testCase.expected), stderr: result.stderr, timedOut: result.timedOut, time: result.time, memory: result.memory });
  }
  return { available: true, total: tests.length, passed: tests.filter((test) => test.passed).length, tests };
};
