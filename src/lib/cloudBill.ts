// A month's cloud bill for a mid-sized app, and common savings. Illustrative.
export const LINES = [
  { id: "compute", label: "Compute (VMs, containers)", usd: 6200 },
  { id: "db", label: "Managed databases", usd: 3100 },
  { id: "nat", label: "NAT gateway data processing", usd: 1400 },
  { id: "egress", label: "Data transfer out", usd: 1800 },
  { id: "storage", label: "Object storage", usd: 900 },
  { id: "logs", label: "Logs and metrics", usd: 1600 },
];
export const FIXES = [
  { id: "rightsize", label: "Right-size oversized instances", line: "compute", cut: 0.3 },
  { id: "commit", label: "Savings plan / reserved capacity", line: "compute", cut: 0.28 },
  { id: "endpoints", label: "VPC endpoints for S3 and DynamoDB", line: "nat", cut: 0.75 },
  { id: "cdn", label: "Serve assets through a CDN", line: "egress", cut: 0.45 },
  { id: "lifecycle", label: "Move old objects to cold storage", line: "storage", cut: 0.55 },
  { id: "retention", label: "Shorter log retention, drop debug logs", line: "logs", cut: 0.6 },
];
export function bill(on: Set<string>) {
  return LINES.map((l) => {
    let usd = l.usd;
    for (const f of FIXES) if (on.has(f.id) && f.line === l.id) usd *= 1 - f.cut;
    return { ...l, now: Math.round(usd) };
  });
}
