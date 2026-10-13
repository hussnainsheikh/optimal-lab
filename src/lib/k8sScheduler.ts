// The scheduler places pods on 3 nodes (4 CPU each) by their CPU requests.
export const NODES = [{ name: "node-a", cpu: 4 }, { name: "node-b", cpu: 4 }, { name: "node-c", cpu: 4, taint: "gpu" }];
export const PODS = [
  { name: "api-1", cpu: 1.5 }, { name: "api-2", cpu: 1.5 }, { name: "worker-1", cpu: 2 }, { name: "web-1", cpu: 1 },
  { name: "train-1", cpu: 2, tolerates: "gpu" }, { name: "web-2", cpu: 1 }, { name: "report", cpu: 1 },
];
export type Frame = { placed: { pod: string; node: string; cpu: number }[]; pending: string[]; text: string; cur: string };
export function frames(): Frame[] {
  const used: Record<string, number> = { "node-a": 0, "node-b": 0, "node-c": 0 };
  const placed: Frame["placed"] = [];
  const pending: string[] = [];
  const out: Frame[] = [];
  for (const p of PODS) {
    const fits = NODES.filter((n) => (!n.taint || p.tolerates === n.taint) && n.cpu - used[n.name] >= p.cpu);
    if (!fits.length) {
      pending.push(p.name);
      const free = NODES.filter((n) => !n.taint).map((n) => `${n.name} ${(n.cpu - used[n.name]).toFixed(1)}`).join(", ");
      out.push({ placed: [...placed], pending: [...pending], cur: p.name, text: `${p.name} requests ${p.cpu} CPU. Free: ${free} (node-c is tainted for GPU jobs). No single node fits, even though the total free is enough. Pending until something frees up or the cluster autoscaler adds a node.` });
      continue;
    }
    const best = fits.sort((a, b) => (b.cpu - used[b.name]) - (a.cpu - used[a.name]))[0];
    used[best.name] += p.cpu;
    placed.push({ pod: p.name, node: best.name, cpu: p.cpu });
    out.push({ placed: [...placed], pending: [...pending], cur: p.name, text: p.tolerates ? `${p.name} tolerates the gpu taint, so node-c is allowed for it: placed there.` : `${p.name} (${p.cpu} CPU) fits on ${fits.map((f) => f.name).join(" and ")}. Scoring prefers the least-allocated: ${best.name}.` });
  }
  return out;
}
