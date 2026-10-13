// Semantic versioning: MAJOR.MINOR.PATCH, and what dependents' version ranges accept.
export const CURRENT = [2, 4, 1];
export type Change = "fix" | "feature" | "breaking";
export function next(changes: Set<Change>) {
  const [M, m, p] = CURRENT;
  if (changes.has("breaking")) return [M + 1, 0, 0];
  if (changes.has("feature")) return [M, m + 1, 0];
  if (changes.has("fix")) return [M, m, p + 1];
  return [M, m, p];
}
export const RANGES = [
  { range: "^2.4.0", rule: "same major: >=2.4.0 <3.0.0" },
  { range: "~2.4.0", rule: "same minor: >=2.4.0 <2.5.0" },
  { range: "2.4.1", rule: "exactly 2.4.1" },
  { range: ">=2.0.0", rule: "anything from 2.0.0 up" },
];
export function accepts(range: string, v: number[]) {
  const [M, m, p] = v;
  const gte = (a: number[], b: number[]) => a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] >= b[2];
  if (range.startsWith("^")) return M === 2 && gte(v, [2, 4, 0]);
  if (range.startsWith("~")) return M === 2 && m === 4 && p >= 0;
  if (range.startsWith(">=")) return gte(v, [2, 0, 0]);
  return v.join(".") === range;
}
