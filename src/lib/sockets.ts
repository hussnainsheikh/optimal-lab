// Which process is listening, and who is connected: what ss, netstat and lsof show. A socket
// table lists listening sockets and live connections, each in a TCP state (LISTEN, ESTABLISHED,
// TIME_WAIT, CLOSE_WAIT, …). Three common problems are read straight off that table: "address
// already in use" when a port is taken (and why SO_REUSEADDR and a lingering TIME_WAIT matter),
// a pile of CLOSE_WAIT meaning the app forgot to close its sockets, and too many TIME_WAIT after
// a burst of short connections. The states and transitions follow the TCP state machine; process
// names, counts and the scenario are illustrative.

export type State = "LISTEN" | "SYN-SENT" | "SYN-RECV" | "ESTABLISHED" | "FIN-WAIT-2" | "CLOSE-WAIT" | "TIME-WAIT" | "LAST-ACK" | "CLOSED";
export const STATE_NOTE: Record<State, string> = {
  LISTEN: "waiting for connections on this port",
  "SYN-SENT": "a connect() is in progress",
  "SYN-RECV": "a half-open incoming connection",
  ESTABLISHED: "an open, working connection",
  "FIN-WAIT-2": "we closed our side, waiting for theirs",
  "CLOSE-WAIT": "they closed; we haven't called close() yet",
  "TIME-WAIT": "we closed; holding the port ~60 s so stray packets die out",
  "LAST-ACK": "closing, waiting for the final ACK",
  CLOSED: "no connection",
};

export type Sock = { proto: "tcp" | "tcp6" | "udp"; state: State | "-"; local: string; peer: string; pid: number; process: string; recvQ: number; sendQ: number };

export type Scenario = "healthy" | "portTaken" | "closeWaitLeak" | "timeWaitFlood";
export const SCENARIO: Record<Scenario, { label: string; blurb: string }> = {
  healthy: { label: "A healthy server", blurb: "A web server listening, with a few live connections." },
  portTaken: { label: "Address already in use", blurb: "A deploy can't bind the port it needs." },
  closeWaitLeak: { label: "CLOSE_WAIT piling up", blurb: "Connections the app never closed." },
  timeWaitFlood: { label: "TIME_WAIT flood", blurb: "Thousands of short-lived connections." },
};

function conns(n: number, state: State, process: string, pid: number, localPort: number): Sock[] {
  return Array.from({ length: n }, (_, i) => ({ proto: "tcp" as const, state, local: `10.0.1.20:${localPort}`, peer: `203.0.113.${10 + (i % 60)}:${40000 + i}`, pid, process, recvQ: state === "CLOSE-WAIT" ? 312 : 0, sendQ: 0 }));
}

export type Snapshot = { socks: Sock[]; summary: Record<string, number>; diagnosis: string; fix: string; tool: string };

export function snapshot(s: Scenario): Snapshot {
  let socks: Sock[] = [];
  let diagnosis = "";
  let fix = "";
  let tool = "ss -tanp";
  if (s === "healthy") {
    socks = [
      { proto: "tcp", state: "LISTEN", local: "0.0.0.0:443", peer: "0.0.0.0:*", pid: 812, process: "nginx", recvQ: 0, sendQ: 0 },
      { proto: "tcp", state: "LISTEN", local: "127.0.0.1:5432", peer: "0.0.0.0:*", pid: 640, process: "postgres", recvQ: 0, sendQ: 0 },
      ...conns(4, "ESTABLISHED", "nginx", 812, 443),
      ...conns(1, "TIME-WAIT", "-", 0, 443),
    ];
    diagnosis = "Two listeners and a handful of established connections. Nothing stuck.";
    fix = "Nothing to fix. `ss -ltnp` shows what's listening; `ss -tanp` shows every connection and its state.";
  } else if (s === "portTaken") {
    socks = [
      { proto: "tcp", state: "LISTEN", local: "0.0.0.0:8080", peer: "0.0.0.0:*", pid: 9001, process: "old-api", recvQ: 0, sendQ: 0 },
      ...conns(2, "ESTABLISHED", "old-api", 9001, 8080),
      ...conns(1, "TIME-WAIT", "-", 0, 8080),
    ];
    diagnosis = "The new process can't bind 0.0.0.0:8080 because the old one (pid 9001) is still listening on it. A leftover TIME-WAIT on the port can also block a bind without SO_REUSEADDR.";
    fix = "Find the holder with `lsof -i :8080` or `ss -ltnp 'sport = :8080'`, then stop it. Set SO_REUSEADDR so a restart can rebind through a lingering TIME-WAIT.";
    tool = "lsof -i :8080";
  } else if (s === "closeWaitLeak") {
    socks = [
      { proto: "tcp", state: "LISTEN", local: "0.0.0.0:3000", peer: "0.0.0.0:*", pid: 1200, process: "app", recvQ: 0, sendQ: 0 },
      ...conns(2, "ESTABLISHED", "app", 1200, 3000),
      ...conns(240, "CLOSE-WAIT", "app", 1200, 3000),
    ];
    diagnosis = "240 sockets in CLOSE-WAIT. The other side closed, but the app (pid 1200) never called close(), so each socket and its file descriptor leak. Eventually it hits the open-files limit and stops accepting connections.";
    fix = "CLOSE-WAIT is always an application bug, not a network one: find the path that doesn't close its connections. The count only grows until the process is fixed and restarted.";
  } else {
    socks = [
      { proto: "tcp", state: "LISTEN", local: "0.0.0.0:443", peer: "0.0.0.0:*", pid: 812, process: "nginx", recvQ: 0, sendQ: 0 },
      ...conns(3, "ESTABLISHED", "nginx", 812, 443),
      ...conns(28000, "TIME-WAIT", "-", 0, 443),
    ];
    diagnosis = "28,000 sockets in TIME-WAIT. Each closed connection holds its port for about 60 seconds. This is normal after a burst of short connections, but it can exhaust ephemeral ports when the server is also a client to a backend.";
    fix = "Mostly harmless on the server side. Reuse connections (keep-alive, a connection pool) so fewer close so often. The states clear themselves after the timeout; don't disable TIME-WAIT.";
  }
  const summary: Record<string, number> = {};
  for (const sk of socks) summary[sk.state] = (summary[sk.state] ?? 0) + 1;
  return { socks, summary, diagnosis, fix, tool };
}

// The TCP state machine: the path a connection walks on a clean active close.
export const CLOSE_PATH: { state: State; event: string }[] = [
  { state: "ESTABLISHED", event: "open and exchanging data" },
  { state: "FIN-WAIT-2", event: "we called close(): sent FIN" },
  { state: "TIME-WAIT", event: "they sent FIN; we ACK and wait" },
  { state: "CLOSED", event: "after ~60 s, the socket is gone" },
];
export const PASSIVE_PATH: { state: State; event: string }[] = [
  { state: "ESTABLISHED", event: "open and exchanging data" },
  { state: "CLOSE-WAIT", event: "they sent FIN; now we must close()" },
  { state: "LAST-ACK", event: "we called close(): sent FIN" },
  { state: "CLOSED", event: "their ACK arrives; the socket is gone" },
];

export const EPHEMERAL = 28232; // 60999 − 32768 on Linux
export function portPressure(timeWait: number) {
  return { used: timeWait, total: EPHEMERAL, share: timeWait / EPHEMERAL };
}
