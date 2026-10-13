// A small process tree and what signals and exits do to it.
export type Scenario = "sigterm" | "sigkill" | "orphan" | "zombie";
export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "sigterm", label: "kill <pid> (SIGTERM)" },
  { id: "sigkill", label: "kill -9 <pid> (SIGKILL)" },
  { id: "orphan", label: "Parent dies first" },
  { id: "zombie", label: "Parent never calls wait()" },
];
export type P = { pid: number; ppid: number; name: string; state: "running" | "stopping" | "gone" | "zombie" };
export type Frame = { procs: P[]; text: string; bad?: boolean };
const base = (): P[] => [
  { pid: 1, ppid: 0, name: "systemd", state: "running" },
  { pid: 812, ppid: 1, name: "node server.js", state: "running" },
  { pid: 820, ppid: 812, name: "worker 1", state: "running" },
  { pid: 821, ppid: 812, name: "worker 2", state: "running" },
];
export function frames(s: Scenario): Frame[] {
  const p = base();
  const out: Frame[] = [{ procs: p.map((x) => ({ ...x })), text: "systemd (PID 1) started the server, which forked two workers. Each process knows its parent (PPID)." }];
  const snap = (text: string, bad = false) => out.push({ procs: p.map((x) => ({ ...x })), text, bad });
  const set = (pid: number, st: P["state"]) => (p.find((x) => x.pid === pid)!.state = st);
  if (s === "sigterm") {
    set(812, "stopping"); snap("SIGTERM asks politely. The server's handler stops accepting new requests and tells its workers to finish.");
    set(820, "gone"); set(821, "gone"); snap("Workers finish in-flight requests and exit; the server reaps them with wait().");
    set(812, "gone"); snap("The server exits with code 0. Nothing was cut off. This is what docker stop and Kubernetes send first.");
  } else if (s === "sigkill") {
    set(812, "gone"); snap("SIGKILL can't be caught. The kernel removes the server instantly: no cleanup, in-flight requests dropped, files possibly half-written.", true);
    p.find((x) => x.pid === 820)!.ppid = 1; p.find((x) => x.pid === 821)!.ppid = 1; snap("Its workers are now orphans, re-parented to PID 1. Use kill -9 only when SIGTERM didn't work.", true);
  } else if (s === "orphan") {
    set(812, "gone"); p.find((x) => x.pid === 820)!.ppid = 1; p.find((x) => x.pid === 821)!.ppid = 1; snap("The server crashes. Its children keep running, adopted by PID 1, which will reap them when they exit.");
    snap("In a container, your app is often PID 1 and doesn't reap orphans. Use an init like tini (docker run --init).", true);
  } else {
    set(820, "zombie"); snap("Worker 1 exits, but the server never calls wait() for it. Its entry stays in the process table as a zombie <defunct>.", true);
    set(821, "zombie"); snap("Zombies use no CPU or memory, but each holds a PID. Leak enough and fork() fails. Kill the parent to clear them.", true);
  }
  return out;
}
