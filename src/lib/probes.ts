// Kubernetes probes over one pod's life. The app needs 20 s to warm up, and at 60 s it hangs
// (a deadlock: the process is alive but answers nothing). Requests arrive every 5 s.

export type ProbeSet = "none" | "readiness" | "liveness" | "both";

export const SETS: { id: ProbeSet; label: string }[] = [
  { id: "none", label: "No probes" },
  { id: "readiness", label: "Readiness only" },
  { id: "liveness", label: "Liveness only" },
  { id: "both", label: "Readiness + liveness" },
];

export type Tick = { t: number; app: "starting" | "ready" | "hung" | "restarting"; inService: boolean; request: "ok" | "error" | "skipped" };

export function simulate(set: ProbeSet, until = 120): { ticks: Tick[]; restarts: number; errors: number } {
  const readiness = set === "readiness" || set === "both";
  const liveness = set === "liveness" || set === "both";
  const ticks: Tick[] = [];
  let started = 0; // when the current container started
  let restarts = 0;
  let restartUntil = -1;
  for (let t = 0; t <= until; t += 5) {
    let app: Tick["app"];
    if (t < restartUntil) app = "restarting";
    else {
      const age = t - started;
      const hung = restarts === 0 && t >= 60;
      app = hung ? "hung" : age < 20 ? "starting" : "ready";
      // liveness: 3 failed checks 5 s apart after the hang → restart
      if (liveness && app === "hung" && t >= 75) {
        restarts++;
        restartUntil = t + 5;
        started = t + 5;
        app = "restarting";
      }
    }
    const healthy = app === "ready";
    const inService = readiness ? healthy : app !== "restarting";
    const request: Tick["request"] = inService ? (healthy ? "ok" : "error") : "skipped";
    ticks.push({ t, app, inService, request });
  }
  return { ticks, restarts, errors: ticks.filter((x) => x.request === "error").length };
}
