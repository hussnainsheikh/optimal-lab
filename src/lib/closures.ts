// Three closure examples: what each function remembers.
export type Ex = "var" | "let" | "counter";
export const EXAMPLES: { id: Ex; label: string; code: string[] }[] = [
  { id: "var", label: "var in a loop", code: ["for (var i = 0; i < 3; i++) {", "  setTimeout(() => log(i), 0);", "}"] },
  { id: "let", label: "let in a loop", code: ["for (let i = 0; i < 3; i++) {", "  setTimeout(() => log(i), 0);", "}"] },
  { id: "counter", label: "Private counter", code: ["function makeCounter() {", "  let count = 0;", "  return () => ++count;", "}", "const a = makeCounter();", "const b = makeCounter();", "a(); a(); b();"] },
];
export type Scope = { name: string; vars: Record<string, string>; fns: string[] };
export function explain(ex: Ex) {
  if (ex === "var") return {
    scopes: [{ name: "function scope (one for the whole loop)", vars: { i: "3" }, fns: ["callback 1", "callback 2", "callback 3"] }],
    output: "3 3 3",
    text: "var creates one i for the whole function. All three callbacks close over that same variable, and by the time they run the loop has left it at 3.",
  };
  if (ex === "let") return {
    scopes: [0, 1, 2].map((i) => ({ name: `iteration ${i + 1} scope`, vars: { i: String(i) }, fns: [`callback ${i + 1}`] })),
    output: "0 1 2",
    text: "let creates a fresh i for each iteration. Each callback closes over its own copy.",
  };
  return {
    scopes: [{ name: "makeCounter call for a", vars: { count: "2" }, fns: ["a"] }, { name: "makeCounter call for b", vars: { count: "1" }, fns: ["b"] }],
    output: "1 2 1",
    text: "Each call to makeCounter creates a new scope. The returned function keeps it alive, so count persists between calls and nothing outside can touch it.",
  };
}
