// A container is an ordinary process with two kernel features applied. Namespaces change what
// it can see: its own process IDs, mounts, network, hostname, users and IPC. Cgroups limit what
// it can use: memory, CPU time and the number of processes. Toggle each namespace and read what
// the same commands print inside; then run into each cgroup limit. The CPU limit follows the
// kernel's CFS bandwidth control exactly: a quota of CPU time per 100 ms period, shared by all
// of the container's threads, and once it's spent every thread waits for the next period.
// Host names, addresses and the app's numbers are illustrative.

export type Ns = "pid" | "mnt" | "net" | "uts" | "user" | "ipc";
export const NAMESPACES: Ns[] = ["pid", "mnt", "net", "uts", "user", "ipc"];
export const NS: Record<Ns, { label: string; flag: string; cmd: string; isolates: string }> = {
  pid: { label: "PID", flag: "CLONE_NEWPID", cmd: "ps -e", isolates: "process IDs: the app is PID 1 and sees only its own processes" },
  mnt: { label: "Mount", flag: "CLONE_NEWNS", cmd: "ls /", isolates: "the file system tree: pivot_root into the image's files" },
  net: { label: "Network", flag: "CLONE_NEWNET", cmd: "ip -br addr", isolates: "interfaces, routes, ports and firewall rules" },
  uts: { label: "UTS", flag: "CLONE_NEWUTS", cmd: "hostname", isolates: "the hostname" },
  user: { label: "User", flag: "CLONE_NEWUSER", cmd: "id; cat /proc/self/uid_map", isolates: "user IDs: root inside maps to an unprivileged user outside" },
  ipc: { label: "IPC", flag: "CLONE_NEWIPC", cmd: "ipcs -m", isolates: "System V shared memory and message queues" },
};

export function view(on: Set<Ns>) {
  const out: Record<Ns, string[]> = {
    pid: on.has("pid")
      ? ["  PID CMD", "    1 app", "    7 sh"]
      : ["  PID CMD", "    1 systemd", "  812 sshd", " 1544 postgres", " 9120 other-container-app", "23011 app"],
    mnt: on.has("mnt") ? ["app  bin  etc  lib  usr   (the image's files)"] : ["bin  boot  etc  home  root  srv  usr  var   (the host's files)"],
    net: on.has("net") ? ["lo     UNKNOWN 127.0.0.1/8", "eth0   UP      10.0.3.2/24   (one end of a veth pair)"] : ["lo       UNKNOWN 127.0.0.1/8", "ens5     UP      172.31.4.18/20", "docker0  UP      172.17.0.1/16"],
    uts: on.has("uts") ? ["web-7f9c"] : ["prod-host-3"],
    user: on.has("user") ? ["uid=0(root) gid=0(root)", "         0     100000      65536   (root here is uid 100000 on the host)"] : ["uid=0(root) gid=0(root)", "         0          0 4294967295   (root here is root on the host)"],
    ipc: on.has("ipc") ? ["------ Shared Memory Segments --------", "(none)"] : ["------ Shared Memory Segments --------", "0x0052e2c1 postgres 56 MB", "0x00000000 other-container-app 8 MB"],
  };
  return out;
}

// What a compromised process inside could still reach
export function exposure(on: Set<Ns>) {
  const risks: { risk: string; closedBy: Ns }[] = [
    { risk: "see and signal every process on the host (kill postgres)", closedBy: "pid" },
    { risk: "read and write the host's files", closedBy: "mnt" },
    { risk: "bind host ports and sniff other containers' traffic", closedBy: "net" },
    { risk: "if it escapes, it's root on the host", closedBy: "user" },
    { risk: "read other processes' shared memory", closedBy: "ipc" },
  ];
  return risks.map((r) => ({ ...r, open: !on.has(r.closedBy) }));
}

// CFS bandwidth: `threads` threads each need `perThreadMs` of CPU (running in parallel on enough
// cores), under a quota of `quotaMs` per `periodMs`. Returns when the work finishes and the
// periods with how much ran and how long it was throttled.
export function cpuLimit(threads: number, perThreadMs: number, quotaMs: number | null, periodMs = 100) {
  if (quotaMs === null) return { doneMs: perThreadMs, periods: [{ start: 0, ranMs: perThreadMs, throttledMs: 0 }], throttledMs: 0 };
  const periods: { start: number; ranMs: number; throttledMs: number }[] = [];
  let left = perThreadMs, t = 0, throttledMs = 0; // every thread has the same work left
  while (left > 1e-9) {
    const run = Math.min(quotaMs / threads, left, periodMs); // all threads burn the shared quota together
    left -= run;
    if (left > 1e-9) {
      const wait = periodMs - run;
      periods.push({ start: t, ranMs: run, throttledMs: wait });
      throttledMs += wait;
      t += periodMs;
    } else {
      periods.push({ start: t, ranMs: run, throttledMs: 0 });
      t += run;
    }
  }
  return { doneMs: t, periods, throttledMs };
}

// memory.max: a process that grows `mbPerSec` from `startMb` is OOM-killed when it reaches the limit
export const oomAfter = (limitMb: number, startMb = 120, mbPerSec = 40) => (limitMb - startMb) / mbPerSec;

// pids.max: a fork bomb doubles every step until fork() fails with EAGAIN
export function forkBomb(pidsMax: number | null) {
  const steps: number[] = [];
  let n = 1;
  for (let i = 0; i < 12; i++) { steps.push(n); if (pidsMax !== null && n * 2 > pidsMax) { steps.push(pidsMax); break; } n *= 2; }
  return { steps, stopped: pidsMax !== null };
}
