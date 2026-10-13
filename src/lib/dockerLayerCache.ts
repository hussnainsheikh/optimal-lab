// Two Dockerfiles for the same Node app. Which layers rebuild after a change?
export type Order = "bad" | "good";
export type Change = "code" | "deps" | "none";
export const FILES: Record<Order, { line: string; secs: number; deps: Change[] }[]> = {
  bad: [
    { line: "FROM node:22-slim", secs: 0, deps: [] },
    { line: "WORKDIR /app", secs: 0, deps: [] },
    { line: "COPY . .", secs: 1, deps: ["code", "deps"] },
    { line: "RUN npm ci", secs: 45, deps: [] },
    { line: "RUN npm run build", secs: 20, deps: [] },
    { line: 'CMD ["node", "dist/server.js"]', secs: 0, deps: [] },
  ],
  good: [
    { line: "FROM node:22-slim", secs: 0, deps: [] },
    { line: "WORKDIR /app", secs: 0, deps: [] },
    { line: "COPY package.json package-lock.json ./", secs: 1, deps: ["deps"] },
    { line: "RUN npm ci", secs: 45, deps: [] },
    { line: "COPY . .", secs: 1, deps: ["code", "deps"] },
    { line: "RUN npm run build", secs: 20, deps: [] },
    { line: 'CMD ["node", "dist/server.js"]', secs: 0, deps: [] },
  ],
};
export function build(o: Order, c: Change) {
  const lines = FILES[o];
  const first = c === "none" ? -1 : lines.findIndex((l) => l.deps.includes(c));
  const rows = lines.map((l, i) => ({ ...l, cached: first < 0 || i < first }));
  return { rows, secs: rows.filter((r) => !r.cached).reduce((a, r) => a + r.secs, 0) };
}
