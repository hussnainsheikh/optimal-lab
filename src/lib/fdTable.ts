// File descriptors, as the kernel keeps them: three tables.
// 1. Each process has an fd table: small integers, each pointing to an open file description.
// 2. An open file description (the kernel's "struct file") holds the offset and the flags.
//    dup()/dup2() and fork() share one; calling open() twice makes two.
// 3. The description points to the file itself: an inode, a pipe, a socket or a terminal.
// open() always returns the lowest free number. Scenarios run step by step on that model.

export type Desc = { id: number; target: string; offset: number; flags: string; refs: number };
export type Proc = { name: string; fds: Record<number, number> }; // fd -> description id
export type State = { procs: Proc[]; descs: Record<number, Desc>; files: Record<string, string> };
export type Step = { who: string; call: string; result: string; state: State; bad?: boolean; good?: boolean; hl?: { proc: string; fd: number }[] };

const clone = (s: State): State => ({ procs: s.procs.map((p) => ({ name: p.name, fds: { ...p.fds } })), descs: Object.fromEntries(Object.entries(s.descs).map(([k, d]) => [k, { ...d }])), files: { ...s.files } });

class Kernel {
  s: State;
  steps: Step[] = [];
  next = 10;
  limit = Infinity;
  constructor(procName = "shell") {
    this.s = { procs: [{ name: procName, fds: {} }], descs: {}, files: {} };
    for (const fd of [0, 1, 2]) this.s.procs[0].fds[fd] = this.desc("terminal", "rw");
  }
  desc(target: string, flags: string) {
    const id = this.next++;
    this.s.descs[id] = { id, target, offset: 0, flags, refs: 1 };
    return id;
  }
  proc(name: string) { return this.s.procs.find((p) => p.name === name)!; }
  log(who: string, call: string, result: string, extra: Partial<Step> = {}) { this.steps.push({ who, call, result, state: clone(this.s), ...extra }); }
  lowest(p: Proc) { let fd = 0; while (p.fds[fd] !== undefined) fd++; return fd; }
  open(who: string, path: string, flags: string, quiet = false) {
    const p = this.proc(who);
    const fd = this.lowest(p);
    if (fd >= this.limit) { if (!quiet) this.log(who, `open("${path}")`, "-1 EMFILE: Too many open files", { bad: true }); return -1; }
    if (flags.includes("O_TRUNC")) this.s.files[path] = "";
    else this.s.files[path] ??= "";
    p.fds[fd] = this.desc(path, flags);
    if (!quiet) this.log(who, `open("${path}", ${flags})`, `→ ${fd} (the lowest free number)`, { hl: [{ proc: who, fd }] });
    return fd;
  }
  close(who: string, fd: number) {
    const p = this.proc(who);
    const d = this.s.descs[p.fds[fd]];
    delete p.fds[fd];
    d.refs--;
    if (d.refs === 0) delete this.s.descs[d.id];
    this.log(who, `close(${fd})`, d.refs ? `fd ${fd} gone; the description lives on (${d.refs} more ref${d.refs === 1 ? "" : "s"})` : `fd ${fd} gone, and its description with it`);
  }
  dup2(who: string, from: number, to: number) {
    const p = this.proc(who);
    if (p.fds[to] !== undefined) { const old = this.s.descs[p.fds[to]]; old.refs--; if (!old.refs) delete this.s.descs[old.id]; }
    p.fds[to] = p.fds[from];
    this.s.descs[p.fds[from]].refs++;
    this.log(who, `dup2(${from}, ${to})`, `fd ${to} now points where fd ${from} does: ${this.s.descs[p.fds[from]].target}`, { hl: [{ proc: who, fd: to }, { proc: who, fd: from }] });
  }
  write(who: string, fd: number, text: string) {
    const d = this.s.descs[this.proc(who).fds[fd]];
    if (d.target === "terminal") { this.log(who, `write(${fd}, "${text}")`, "shows on the terminal", { hl: [{ proc: who, fd }] }); return; }
    const f = this.s.files[d.target] ?? "";
    const at = d.flags.includes("O_APPEND") ? f.length : d.offset;
    const clobbers = at < f.length;
    this.s.files[d.target] = f.slice(0, at) + text + f.slice(at + text.length);
    d.offset = at + text.length;
    this.log(who, `write(${fd}, "${text}")`, `${text.length} bytes at offset ${at} of ${d.target}${clobbers ? ", over bytes already there" : ""}; offset → ${d.offset}`, { bad: clobbers, hl: [{ proc: who, fd }] });
  }
  fork(parent: string, child: string) {
    const p = this.proc(parent);
    const c: Proc = { name: child, fds: { ...p.fds } };
    for (const id of Object.values(p.fds)) this.s.descs[id].refs++;
    this.s.procs.push(c);
    this.log(parent, "fork()", `${child} gets a copy of the fd table; every entry shares the parent's descriptions, offsets included`);
  }
  exec(who: string, prog: string) {
    const p = this.proc(who);
    const closed: number[] = [];
    for (const [fd, id] of Object.entries(p.fds)) {
      const d = this.s.descs[id];
      if (d.flags.includes("O_CLOEXEC")) { delete p.fds[Number(fd)]; d.refs--; if (!d.refs) delete this.s.descs[d.id]; closed.push(Number(fd)); }
    }
    p.name = prog;
    const leaked = Object.entries(p.fds).filter(([fd]) => Number(fd) > 2);
    const parts = [
      ...(closed.length ? [`O_CLOEXEC closed fd ${closed.join(", ")}`] : []),
      ...(leaked.length ? [`the plugin inherits fd ${leaked.map(([fd, id]) => `${fd} (${this.s.descs[id].target})`).join(", ")} and can read it`] : []),
    ];
    this.log(prog, `execve("${prog}")`, parts.join("; ") || "the fd table carries over", { bad: leaked.length > 0, good: !leaked.length && closed.length > 0 });
  }
}

export type Scenario = "redirect" | "redirectWrong" | "forkShared" | "twoOpens" | "leak" | "cloexec";
export const SCENARIOS: Scenario[] = ["redirect", "redirectWrong", "forkShared", "twoOpens", "leak", "cloexec"];
export const SCENARIO: Record<Scenario, { label: string; cmd: string; blurb: string }> = {
  redirect: { label: "cmd > out 2>&1", cmd: "cmd > out.log 2>&1", blurb: "The shell sets up a command's stdout and stderr to go to one file." },
  redirectWrong: { label: "cmd 2>&1 > out", cmd: "cmd 2>&1 > out.log", blurb: "Same redirections, other order. Redirections run left to right." },
  forkShared: { label: "fork shares the offset", cmd: "open log, fork, both write", blurb: "A parent opens a log, forks a worker, and both write to it." },
  twoOpens: { label: "two open() calls", cmd: "two processes open the log", blurb: "Two processes each open the same log on their own, then write." },
  leak: { label: "Leak until EMFILE", cmd: "open per request, never close", blurb: "A server opens a file for each request and forgets to close it, with ulimit -n 1024." },
  cloexec: { label: "Inherited by exec", cmd: "open a secret, then run a plugin", blurb: "A process opens a key file, then forks and execs an untrusted plugin." },
};

export function run(sc: Scenario): Step[] {
  if (sc === "redirect" || sc === "redirectWrong") {
    const k = new Kernel("shell");
    k.fork("shell", "cmd");
    if (sc === "redirect") {
      const fd = k.open("cmd", "out.log", "O_WRONLY|O_CREAT|O_TRUNC");
      k.dup2("cmd", fd, 1);
      k.close("cmd", fd);
      k.dup2("cmd", 1, 2);
    } else {
      k.dup2("cmd", 1, 2);
      const fd = k.open("cmd", "out.log", "O_WRONLY|O_CREAT|O_TRUNC");
      k.dup2("cmd", fd, 1);
      k.close("cmd", fd);
    }
    k.write("cmd", 1, "ok ");
    k.write("cmd", 2, "error!");
    return k.steps;
  }
  if (sc === "forkShared" || sc === "twoOpens") {
    const k = new Kernel("server");
    if (sc === "forkShared") {
      const fd = k.open("server", "app.log", "O_WRONLY|O_CREAT|O_TRUNC");
      k.fork("server", "worker");
      k.write("worker", fd, "[worker] up\n");
      k.write("server", fd, "[server] up\n");
    } else {
      k.s.procs.push({ name: "worker", fds: { 0: k.s.procs[0].fds[0], 1: k.s.procs[0].fds[1], 2: k.s.procs[0].fds[2] } });
      for (const fd of [0, 1, 2]) k.s.descs[k.s.procs[0].fds[fd]].refs++;
      const a = k.open("server", "app.log", "O_WRONLY|O_CREAT|O_TRUNC");
      const b = k.open("worker", "app.log", "O_WRONLY|O_CREAT");
      k.write("worker", b, "[worker] up\n");
      k.write("server", a, "[server] up\n");
    }
    return k.steps;
  }
  if (sc === "leak") {
    const k = new Kernel("server");
    k.limit = 1024;
    k.open("server", "/var/data/req-1.json", "O_RDONLY");
    k.open("server", "/var/data/req-2.json", "O_RDONLY");
    let n = 3;
    while (k.open("server", `/var/data/req-${n}.json`, "O_RDONLY", true) >= 0) n++;
    k.log("server", `… ${n - 3} more open() calls, none closed`, `fds 3 to ${k.lowest(k.proc("server")) - 1} are all taken`);
    k.open("server", `/var/data/req-${n}.json`, "O_RDONLY");
    k.log("server", "accept()", "-1 EMFILE: new connections fail too: a socket needs an fd as well", { bad: true });
    return k.steps;
  }
  // cloexec: show both ways in one run
  const k = new Kernel("app");
  const fd = k.open("app", "/etc/app/key.pem", "O_RDONLY");
  const fd2 = k.open("app", "/etc/app/db-password", "O_RDONLY|O_CLOEXEC");
  k.fork("app", "child");
  k.exec("child", "plugin");
  k.write("app", 1, `fds ${fd} and ${fd2} stay open in app`);
  return k.steps;
}

export const fileText = (s: State, path: string) => s.files[path];
