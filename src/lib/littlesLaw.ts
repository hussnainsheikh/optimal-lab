// A service with 8 workers, each taking 40 ms per request. How does latency react as traffic rises?
export const WORKERS = 8, SERVICE_MS = 40;
export const CAPACITY = (WORKERS * 1000) / SERVICE_MS; // 200 req/s
// Waiting time from a simple queueing approximation (M/M/c-ish): grows like 1/(1-ρ).
export function at(rps: number) {
  const rho = Math.min(0.995, rps / CAPACITY);
  const wait = rho < 0.5 ? SERVICE_MS * rho ** WORKERS : (SERVICE_MS / WORKERS) * (rho ** (2 * Math.sqrt(WORKERS)) / (1 - rho));
  const latency = SERVICE_MS + wait;
  const inFlight = (rps * latency) / 1000; // Little's law: L = λW
  return { rho, latency, inFlight, wait };
}
export const curve = () => Array.from({ length: 40 }, (_, i) => { const rps = (CAPACITY * (i + 1)) / 41; return { rps, ...at(rps) }; });
