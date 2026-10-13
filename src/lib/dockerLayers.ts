// Docker layer caching. Each Dockerfile instruction makes a layer. A layer is reused from the
// cache only if its inputs are unchanged AND every layer before it was reused. So the order of
// instructions decides how much of the build reruns after a small change.

export type Change = "none" | "code" | "deps";
export type Line = { text: string; seconds: number; inputs: ("code" | "deps")[] };

export const CHANGES: { id: Change; label: string }[] = [
  { id: "code", label: "Edit src/app.js" },
  { id: "deps", label: "Add a package" },
  { id: "none", label: "Rebuild, nothing changed" },
];

export const FILES: { id: "naive" | "ordered"; label: string; note: string; lines: Line[] }[] = [
  {
    id: "naive",
    label: "Copy everything first",
    note: "COPY . . comes before npm ci, so any file change invalidates the install.",
    lines: [
      { text: "FROM node:22-slim", seconds: 0, inputs: [] },
      { text: "WORKDIR /app", seconds: 0, inputs: [] },
      { text: "COPY . .", seconds: 2, inputs: ["code", "deps"] },
      { text: "RUN npm ci", seconds: 45, inputs: [] },
      { text: "RUN npm run build", seconds: 20, inputs: [] },
      { text: 'CMD ["node", "dist/server.js"]', seconds: 0, inputs: [] },
    ],
  },
  {
    id: "ordered",
    label: "Dependencies first",
    note: "Copy only package.json and the lock file, install, then copy the code.",
    lines: [
      { text: "FROM node:22-slim", seconds: 0, inputs: [] },
      { text: "WORKDIR /app", seconds: 0, inputs: [] },
      { text: "COPY package.json package-lock.json ./", seconds: 1, inputs: ["deps"] },
      { text: "RUN npm ci", seconds: 45, inputs: [] },
      { text: "COPY . .", seconds: 2, inputs: ["code", "deps"] },
      { text: "RUN npm run build", seconds: 20, inputs: [] },
      { text: 'CMD ["node", "dist/server.js"]', seconds: 0, inputs: [] },
    ],
  },
];

export function build(lines: Line[], change: Change) {
  let broken = false;
  const rows = lines.map((l) => {
    if (!broken && change !== "none" && l.inputs.includes(change)) broken = true;
    return { ...l, cached: !broken };
  });
  return { rows, seconds: rows.filter((r) => !r.cached).reduce((s, r) => s + r.seconds, 0) };
}
