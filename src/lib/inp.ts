// A click handler that does 300 ms of work. When does the screen update?
export type Mode = "block" | "yield" | "worker";
export const MODES: { id: Mode; label: string }[] = [
  { id: "block", label: "Do all the work in the handler" },
  { id: "yield", label: "Update UI first, then yield and continue" },
  { id: "worker", label: "Send the work to a Web Worker" },
];
export function timeline(m: Mode) {
  if (m === "block") return { blocks: [{ from: 0, to: 300, label: "filter 10k rows" }], paint: 316, done: 316 };
  if (m === "yield") return { blocks: [{ from: 0, to: 8, label: "show spinner" }, { from: 24, to: 124, label: "chunk 1" }, { from: 130, to: 230, label: "chunk 2" }, { from: 236, to: 336, label: "chunk 3" }], paint: 24, done: 352 };
  return { blocks: [{ from: 0, to: 6, label: "post to worker" }, { from: 310, to: 318, label: "render result" }], paint: 22, done: 334 };
}
export const rating = (ms: number) => (ms <= 200 ? "good" : ms <= 500 ? "needs improvement" : "poor");
