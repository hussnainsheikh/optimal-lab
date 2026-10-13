// What await pauses, and sequential vs parallel awaits.
export const CODE = [
  "async function load() {",
  '  log("B: load starts");',
  "  const user = await getUser();",
  '  log("E: got " + user);',
  "}",
  'log("A: script starts");',
  "load();",
  'log("C: load() returned a promise");',
  'setTimeout(() => log("F: timer"), 0);',
  'log("D: script ends");',
];
export const STEPS = [
  { line: 5, out: "A", text: "Synchronous code runs top to bottom." },
  { line: 6, out: "", text: "Calling an async function runs its body right away…" },
  { line: 1, out: "B", text: "…up to the first await." },
  { line: 2, out: "", text: "await getUser(): the rest of load() is parked as a microtask for when the promise settles. Control returns to the caller." },
  { line: 7, out: "C", text: "load() has already returned a pending promise. The script carries on." },
  { line: 8, out: "", text: "The timer callback goes in the task queue." },
  { line: 9, out: "D", text: "The script finishes. The stack is empty." },
  { line: 3, out: "E", text: "Microtasks run first: load() resumes after its await." },
  { line: 8, out: "F", text: "Then the next task: the timer." },
];
export const CALLS = [{ name: "getUser()", ms: 300 }, { name: "getOrders()", ms: 500 }, { name: "getPrefs()", ms: 200 }];
export function timing(parallel: boolean) {
  let t = 0;
  const bars = CALLS.map((c) => { const start = parallel ? 0 : t; t = parallel ? Math.max(t, c.ms) : t + c.ms; return { ...c, start, end: start + c.ms }; });
  return { bars, total: Math.max(...bars.map((b) => b.end)) };
}
