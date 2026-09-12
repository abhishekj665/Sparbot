export const defaultJavaStarterCode = `class Solution {
  public Object solve() {
    return null;
  }
}`;

export const isJavaSource = (source) =>
  /\bclass\s+Solution\s*\{/.test(source || "") &&
  /\bpublic\s+[A-Za-z_<>, ?[\]]+\s+[A-Za-z_]\w*\s*\(/.test(source || "") &&
  !/\bpublic\s+static\s+void\s+main\s*\(/.test(source || "");

const withoutComments = (source) =>
  String(source || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const starterCodeFor = (question) => {
  const starterCode = question?.starterCode;
  const javaStarter =
    starterCode?.java || (typeof starterCode === "string" ? starterCode : "");
  return isJavaSource(javaStarter)
    ? withoutComments(javaStarter)
    : defaultJavaStarterCode;
};
