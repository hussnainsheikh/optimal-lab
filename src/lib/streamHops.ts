// Tokens flowing model → API server → proxy → browser, with or without buffering.
export type Mode = "none" | "proxy-buffers" | "end-to-end";
export const MODES: { id: Mode; label: string }[] = [
  { id: "none", label: "No streaming" },
  { id: "proxy-buffers", label: "Streams, but the proxy buffers" },
  { id: "end-to-end", label: "Streaming end to end" },
];
export const HOPS = ["Model", "API server", "Proxy / CDN", "Browser"];
export const TOKENS = "Sure! Here are three ways to make your page load faster: compress images, cache static files at a CDN, and defer scripts you don't need for the first paint.".split(" ");
export const TTFT = 0.6;
export const PER = 0.25;
export const DONE = TTFT + PER * (TOKENS.length - 1);
export const TIMES = Array.from({ length: Math.ceil((DONE + 1) / 0.5) + 1 }, (_, i) => i * 0.5);

export function at(mode: Mode, t: number) {
  const produced = t < TTFT ? 0 : Math.min(TOKENS.length, Math.floor((t - TTFT) / PER) + 1);
  const all = t >= DONE + 0.1;
  const api = mode === "none" ? (all ? TOKENS.length : 0) : produced;
  const proxy = mode === "end-to-end" ? api : all ? TOKENS.length : 0;
  const counts = [produced, api, proxy, proxy];
  const firstSeen = mode === "end-to-end" ? TTFT : Math.ceil((DONE + 0.1) * 2) / 2;
  return { counts, text: TOKENS.slice(0, proxy).join(" "), firstSeen };
}
