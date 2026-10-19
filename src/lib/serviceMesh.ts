// Checkout calls the pricing service 100 times. Without a mesh the application
// code does the retrying, the encryption and the canary routing, or nobody does.
// With a sidecar beside each service, the sidecars do it. The numbers come from
// each version's error rate, the retry count and the sidecar overhead.

export type Settings = { mesh: boolean; mtls: boolean; retries: 0 | 1 | 2 | 3; timeout: boolean; canary: 0 | 10 | 50 | 100 };
export const OFF: Settings = { mesh: false, mtls: false, retries: 0, timeout: false, canary: 0 };

export const REQUESTS = 100;
export const V1 = { label: "pricing v1", fail: 0.03, ms: 20 }; // transient failures: a dropped connection, a pod restarting
export const V2 = { label: "pricing v2", fail: 0.2, ms: 25 }; // the new build has a bug on one code path
export const HANG = 0.01; // share of requests that hang on a dead connection
export const HANG_MS = 30000; // how long a client waits with no timeout (the kernel's)
export const TIMEOUT_MS = 500;
export const SIDECAR_MS = 1; // added per sidecar passed (two per call)
export const MTLS_MS = 0.3; // handshake amortised over a kept-alive connection
export const SIDECAR_MB = 60;
export const PODS = 40;
export const RETRY_BUDGET = 0.2; // retries may add at most 20% load
export const RETRIES: Settings["retries"][] = [0, 1, 2, 3];
export const CANARIES: Settings["canary"][] = [0, 10, 50, 100];

export type Result = {
  toV1: number;
  toV2: number;
  firstTryErrors: number; // what users would see with no retries
  userErrors: number; // what users see after retries
  retryAttempts: number;
  budgetCap: number;
  retriesCapped: boolean;
  avgMs: number;
  worstMs: number;
  overheadMs: number;
  encrypted: boolean;
  identity: string;
  perVersion: { label: string; requests: number; errors: number; rate: number }[];
  canaryVerdict: string;
  memoryMb: number;
};

export function run(s: Settings): Result {
  const retries = s.mesh ? s.retries : 0;
  const toV2 = s.mesh ? Math.round((REQUESTS * s.canary) / 100) : 0;
  const toV1 = REQUESTS - toV2;
  const firstTryErrors = toV1 * V1.fail + toV2 * V2.fail;
  // Each failed attempt is retried while retries and the retry budget remain. The
  // budget is shared, so when it runs out the remaining failures reach the user.
  let f1 = toV1 * V1.fail;
  let f2 = toV2 * V2.fail;
  let budget = REQUESTS * RETRY_BUDGET;
  let retryAttempts = 0;
  let retriesCapped = false;
  for (let k = 0; k < retries; k++) {
    const attempts = f1 + f2;
    if (attempts <= 0) break;
    const allowed = Math.min(attempts, budget);
    if (allowed < attempts) retriesCapped = true;
    const share = allowed / attempts;
    budget -= allowed;
    retryAttempts += allowed;
    f1 = f1 * (1 - share) + f1 * share * V1.fail;
    f2 = f2 * (1 - share) + f2 * share * V2.fail;
  }
  const budgetCap = REQUESTS * RETRY_BUDGET;
  const userErrors = f1 + f2;

  const overheadMs = s.mesh ? 2 * SIDECAR_MS + (s.mtls ? MTLS_MS : 0) : 0;
  const base = (toV1 * V1.ms + toV2 * V2.ms) / REQUESTS;
  const avgMs = base + overheadMs + (retryAttempts / REQUESTS) * (base + overheadMs);
  const worstMs = s.mesh && s.timeout ? TIMEOUT_MS * (retries + 1) : HANG_MS;

  const perVersion = [
    { label: V1.label, requests: toV1, errors: toV1 * V1.fail, rate: V1.fail },
    { label: V2.label, requests: toV2, errors: toV2 * V2.fail, rate: V2.fail },
  ];
  const canaryVerdict =
    toV2 === 0
      ? "All traffic on v1. Nobody has seen v2 yet."
      : toV2 === REQUESTS
        ? `Everything on v2: ${Math.round(toV2 * V2.fail)} of ${REQUESTS} requests fail. That is a full outage of one code path, found by every user at once.`
        : `${toV2} of ${REQUESTS} requests went to v2 and ${Math.round(toV2 * V2.fail)} of them failed (${Math.round(V2.fail * 100)}% against v1's ${Math.round(V1.fail * 100)}%). Roll it back; ${toV2}% of users saw it, not all of them.`;

  return {
    toV1,
    toV2,
    firstTryErrors,
    userErrors: Math.max(0, userErrors),
    retryAttempts,
    budgetCap,
    retriesCapped,
    avgMs,
    worstMs,
    overheadMs,
    encrypted: s.mesh && s.mtls,
    identity: s.mesh && s.mtls ? "spiffe://cluster/ns/shop/sa/checkout" : "none: any pod on the network can call pricing",
    perVersion,
    canaryVerdict,
    memoryMb: s.mesh ? SIDECAR_MB * PODS : 0,
  };
}

export const HOPS_DIRECT = ["checkout", "pricing"];
export const HOPS_MESH = ["checkout", "sideA", "sideB", "pricing"];

export function ms(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)} s` : `${v < 10 ? v.toFixed(1) : Math.round(v)} ms`;
}
