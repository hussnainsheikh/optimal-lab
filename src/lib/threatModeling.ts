// A file-sharing app as a data-flow diagram: browser, API, auth service, database,
// object storage, an admin panel and a payment webhook. Threats are listed per flow
// that crosses a trust boundary, by STRIDE category, each rated likelihood × impact
// (1–3 each). Turning on a mitigation lowers its threat's likelihood; the risk
// totals and the ranking are computed.

export type Stride = "S" | "T" | "R" | "I" | "D" | "E";
export const STRIDE: Record<Stride, { name: string; property: string }> = {
  S: { name: "Spoofing", property: "authentication" },
  T: { name: "Tampering", property: "integrity" },
  R: { name: "Repudiation", property: "non-repudiation" },
  I: { name: "Information disclosure", property: "confidentiality" },
  D: { name: "Denial of service", property: "availability" },
  E: { name: "Elevation of privilege", property: "authorization" },
};

export type NodeId = "browser" | "api" | "auth" | "db" | "storage" | "admin" | "payments";
export const NODES: { id: NodeId; label: string; zone: "internet" | "app" | "data" | "third" }[] = [
  { id: "browser", label: "Browser", zone: "internet" },
  { id: "payments", label: "Payment provider", zone: "third" },
  { id: "api", label: "API", zone: "app" },
  { id: "auth", label: "Auth service", zone: "app" },
  { id: "admin", label: "Admin panel", zone: "app" },
  { id: "db", label: "Database", zone: "data" },
  { id: "storage", label: "File storage", zone: "data" },
];

export type FlowId = "browser-api" | "payments-api" | "api-db" | "api-storage" | "browser-storage" | "admin-db";
export const FLOWS: { id: FlowId; from: NodeId; to: NodeId; label: string; crosses: string }[] = [
  { id: "browser-api", from: "browser", to: "api", label: "requests, uploads", crosses: "internet → app" },
  { id: "payments-api", from: "payments", to: "api", label: "payment webhook", crosses: "third party → app" },
  { id: "browser-storage", from: "browser", to: "storage", label: "download links", crosses: "internet → data" },
  { id: "api-db", from: "api", to: "db", label: "queries", crosses: "app → data" },
  { id: "api-storage", from: "api", to: "storage", label: "file writes", crosses: "app → data" },
  { id: "admin-db", from: "admin", to: "db", label: "admin queries", crosses: "staff → data" },
];

export type Threat = { id: string; flow: FlowId; stride: Stride; what: string; likelihood: number; impact: number; mitigation: string; mitigatedLikelihood: number };

export const THREATS: Threat[] = [
  { id: "t1", flow: "browser-api", stride: "S", what: "Credential stuffing logs in as real users", likelihood: 3, impact: 3, mitigation: "MFA and rate limits on login", mitigatedLikelihood: 1 },
  { id: "t2", flow: "browser-api", stride: "E", what: "Change a file id in the URL to read someone else's file", likelihood: 3, impact: 3, mitigation: "Check ownership on every file request", mitigatedLikelihood: 1 },
  { id: "t3", flow: "browser-api", stride: "D", what: "Upload thousands of 5 GB files to fill storage", likelihood: 2, impact: 2, mitigation: "Per-user quotas and upload size limits", mitigatedLikelihood: 1 },
  { id: "t4", flow: "payments-api", stride: "S", what: "Forge a “payment succeeded” webhook to upgrade for free", likelihood: 2, impact: 3, mitigation: "Verify the webhook signature and the event with the provider", mitigatedLikelihood: 1 },
  { id: "t5", flow: "browser-storage", stride: "I", what: "Guess or share a permanent download URL", likelihood: 3, impact: 2, mitigation: "Short-lived signed URLs, private bucket", mitigatedLikelihood: 1 },
  { id: "t6", flow: "api-db", stride: "T", what: "SQL injection through the search box", likelihood: 2, impact: 3, mitigation: "Parameterized queries only", mitigatedLikelihood: 1 },
  { id: "t7", flow: "api-storage", stride: "T", what: "Upload an HTML file that runs script when opened from our domain", likelihood: 2, impact: 2, mitigation: "Serve user files from a separate domain with Content-Disposition: attachment", mitigatedLikelihood: 1 },
  { id: "t8", flow: "admin-db", stride: "R", what: "An admin deletes a user's files and denies it", likelihood: 2, impact: 2, mitigation: "Append-only audit log of admin actions", mitigatedLikelihood: 1 },
  { id: "t9", flow: "admin-db", stride: "E", what: "A phished support agent's session reads every file", likelihood: 2, impact: 3, mitigation: "SSO with hardware keys; admin panel only on the VPN", mitigatedLikelihood: 1 },
  { id: "t10", flow: "api-db", stride: "I", what: "Error pages leak stack traces with connection strings", likelihood: 2, impact: 2, mitigation: "Generic errors outside; details only in internal logs", mitigatedLikelihood: 1 },
];

export const risk = (t: Threat, mitigated: boolean) => (mitigated ? t.mitigatedLikelihood : t.likelihood) * t.impact;
export const band = (r: number) => (r >= 6 ? "high" : r >= 3 ? "medium" : "low");

export type Summary = { total: number; high: number; medium: number; low: number; ranked: { t: Threat; r: number; done: boolean }[] };
export function summarize(done: Set<string>): Summary {
  const ranked = THREATS.map((t) => ({ t, r: risk(t, done.has(t.id)), done: done.has(t.id) })).sort((a, b) => b.r - a.r || a.t.id.localeCompare(b.t.id));
  const count = (b: string) => ranked.filter((x) => band(x.r) === b).length;
  return { total: ranked.reduce((s, x) => s + x.r, 0), high: count("high"), medium: count("medium"), low: count("low"), ranked };
}

export const openOnFlow = (flow: FlowId, done: Set<string>) => THREATS.filter((t) => t.flow === flow && band(risk(t, done.has(t.id))) === "high").length;
export const maxTotal = THREATS.reduce((s, t) => s + t.likelihood * t.impact, 0);
