// Checking a request step by step from the command line, the way you debug "the site is down".
// A request has stages — DNS, TCP connect, TLS, send, first byte — and each command line tool
// looks at one of them: dig for the name, nc or telnet for the port, openssl s_client or curl -v
// for TLS, curl -w for the timing breakdown. Five things can be wrong, and each shows up at a
// different stage with a different tool. This file produces the dig answer, the curl -v trace and
// the timing numbers for each scenario, and says which tool pins the fault. Durations are
// illustrative; the command output follows the real tools' format.

export type Fault = "ok" | "nxdomain" | "wrongIp" | "refused" | "firewalled" | "certExpired" | "slowApp";
export const FAULT: Record<Fault, { label: string; blurb: string }> = {
  ok: { label: "Everything works", blurb: "A healthy request, as a baseline." },
  nxdomain: { label: "The name doesn't resolve", blurb: "A typo or a missing DNS record." },
  wrongIp: { label: "DNS points at the old server", blurb: "A stale record after a move." },
  refused: { label: "Connection refused", blurb: "Nothing is listening on that port." },
  firewalled: { label: "Connection times out", blurb: "A firewall drops the packets silently." },
  certExpired: { label: "The certificate expired", blurb: "TLS fails before any request is sent." },
  slowApp: { label: "The app is slow", blurb: "Everything connects fast, then the server thinks." },
};

export const HOST = "shop.example.com";
const GOOD_IP = "203.0.113.42";
const OLD_IP = "198.51.100.9";

export type Stage = "dns" | "tcp" | "tls" | "ttfb" | "total";
export const STAGE_LABEL: Record<Stage, string> = { dns: "DNS lookup", tcp: "TCP connect", tls: "TLS handshake", ttfb: "First byte", total: "Total" };

export type Probe = { tool: string; cmd: string; stage: Stage };
export const PROBES: Probe[] = [
  { tool: "dig", cmd: `dig +short ${HOST}`, stage: "dns" },
  { tool: "nc", cmd: `nc -vz ${HOST} 443`, stage: "tcp" },
  { tool: "openssl", cmd: `openssl s_client -connect ${HOST}:443`, stage: "tls" },
  { tool: "curl", cmd: `curl -sv https://${HOST}/`, stage: "ttfb" },
];

export type Result = {
  dig: string[]; // dig +short output lines
  resolvedIp: string;
  // cumulative curl timing (ms); a stage is null if the request never reached it
  timing: { dns: number; tcp: number | null; tls: number | null; ttfb: number | null; total: number | null };
  trace: { line: string; stage: Stage; bad?: boolean }[];
  failedStage: Stage | null;
  tool: string; // which probe isolates it
  diagnosis: string;
};

export function run(fault: Fault, rtt: number): Result {
  const dns = Math.round(rtt * 0.6);
  const connect = dns + rtt;
  const tls = connect + 2 * rtt;
  const server = fault === "slowApp" ? 1800 : 30;
  const ttfb = tls + rtt + server;
  const T: Result["timing"] = { dns, tcp: connect, tls, ttfb, total: ttfb + 4 };
  const base: { line: string; stage: Stage; bad?: boolean }[] = [
    { line: `* Host ${HOST}:443 was resolved.`, stage: "dns" },
    { line: `*   Trying ${GOOD_IP}:443...`, stage: "tcp" },
    { line: `* Connected to ${HOST} (${GOOD_IP}) port 443`, stage: "tcp" },
    { line: `* TLS 1.3 handshake, cert valid until 2027-02-10`, stage: "tls" },
    { line: `> GET / HTTP/2`, stage: "ttfb" },
    { line: `< HTTP/2 200`, stage: "ttfb" },
  ];
  switch (fault) {
    case "ok":
      return { dig: [GOOD_IP], resolvedIp: GOOD_IP, timing: T, trace: base, failedStage: null, tool: "curl -w", diagnosis: "All stages are healthy." };
    case "slowApp":
      return { dig: [GOOD_IP], resolvedIp: GOOD_IP, timing: T, trace: base.map((t) => (t.line.startsWith("< HTTP") ? { ...t, line: `< HTTP/2 200   (after ${server} ms of server time)` } : t)), failedStage: null, tool: "curl -w", diagnosis: `DNS, connect and TLS are all fast; the ${server} ms gap before the first byte is server-side. curl -w shows time_starttransfer far after time_appconnect — look at the app, not the network.` };
    case "nxdomain":
      return { dig: ["(no answer — NXDOMAIN)"], resolvedIp: "", timing: { dns, tcp: null, tls: null, ttfb: null, total: null }, trace: [{ line: `* Could not resolve host: ${HOST}`, stage: "dns", bad: true }, { line: `curl: (6) Could not resolve host: ${HOST}`, stage: "dns", bad: true }], failedStage: "dns", tool: "dig", diagnosis: "dig returns no answer: the name doesn't exist. It's DNS — check the record or the spelling, before anything else." };
    case "wrongIp":
      return { dig: [OLD_IP], resolvedIp: OLD_IP, timing: T, trace: base.map((t) => (t.line.includes(GOOD_IP) ? { ...t, line: t.line.replace(GOOD_IP, OLD_IP), bad: true } : t)), failedStage: null, tool: "dig", diagnosis: `dig resolves to ${OLD_IP}, the old server, not ${GOOD_IP}. The site "works" but serves stale content — a DNS cache or a record that wasn't updated.` };
    case "refused":
      return { dig: [GOOD_IP], resolvedIp: GOOD_IP, timing: { dns, tcp: connect, tls: null, ttfb: null, total: connect }, trace: [base[0], base[1], { line: `* connect to ${GOOD_IP} port 443 failed: Connection refused`, stage: "tcp", bad: true }, { line: `curl: (7) Failed to connect to ${HOST} port 443: Connection refused`, stage: "tcp", bad: true }], failedStage: "tcp", tool: "nc", diagnosis: "The connection is refused immediately: the host is up but nothing is listening on 443. nc -vz confirms the closed port. Check the service is running and bound to the right address." };
    case "firewalled":
      return { dig: [GOOD_IP], resolvedIp: GOOD_IP, timing: { dns, tcp: null, tls: null, ttfb: null, total: null }, trace: [base[0], base[1], { line: `*   Trying ${GOOD_IP}:443... (no reply, timing out)`, stage: "tcp", bad: true }, { line: `curl: (28) Failed to connect after 21s: Couldn't connect to server`, stage: "tcp", bad: true }], failedStage: "tcp", tool: "nc", diagnosis: "No reply at all — the connection hangs until it times out. A firewall is dropping the packets silently (a refused connection would answer). Check security groups and firewall rules." };
    case "certExpired":
      return { dig: [GOOD_IP], resolvedIp: GOOD_IP, timing: { dns, tcp: connect, tls: null, ttfb: null, total: tls }, trace: [base[0], base[1], base[2], { line: `* SSL certificate problem: certificate has expired`, stage: "tls", bad: true }, { line: `curl: (60) SSL certificate problem: certificate has expired`, stage: "tls", bad: true }], failedStage: "tls", tool: "openssl", diagnosis: "TCP connects, but TLS fails: the certificate expired. openssl s_client shows the notAfter date in the past. It's never an application problem — renew the certificate." };
  }
}

export const STAGES: Stage[] = ["dns", "tcp", "tls", "ttfb"];
