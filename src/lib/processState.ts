// One process moving through its life: new, ready, running, blocked, zombie, gone.
// The reader sends events; each event is only allowed from certain states.

export type State = "new" | "ready" | "running" | "blocked" | "zombie" | "gone";
export type EventId = "admit" | "dispatch" | "preempt" | "read" | "ioDone" | "open" | "malloc" | "exit" | "reap";

export type Proc = {
  pid: number;
  ppid: number;
  state: State;
  pc: number; // program counter
  cpuMs: number; // CPU time used so far
  heapKb: number;
  fds: { fd: number; what: string }[];
  exitCode: number | null;
  switches: number; // times it was taken off the CPU
};

export const START: Proc = {
  pid: 4121, ppid: 4120, state: "new", pc: 0x401000, cpuMs: 0, heapKb: 132,
  fds: [{ fd: 0, what: "stdin (terminal)" }, { fd: 1, what: "stdout (terminal)" }, { fd: 2, what: "stderr (terminal)" }],
  exitCode: null, switches: 0,
};

/** Fixed parts of the memory map, in KB. */
export const MEMORY = { text: 124, data: 16, stack: 132 };

export const EVENTS: { id: EventId; label: string; from: State[] }[] = [
  { id: "admit", label: "Finish setup", from: ["new"] },
  { id: "dispatch", label: "Give it a CPU", from: ["ready"] },
  { id: "preempt", label: "Time slice ends", from: ["running"] },
  { id: "read", label: "read() from disk", from: ["running"] },
  { id: "ioDone", label: "Disk replies", from: ["blocked"] },
  { id: "open", label: "open() a file", from: ["running"] },
  { id: "malloc", label: "malloc 1 MB", from: ["running"] },
  { id: "exit", label: "exit(0)", from: ["running"] },
  { id: "reap", label: "Parent calls wait()", from: ["zombie"] },
];

export const allowed = (p: Proc, e: EventId) => EVENTS.find((x) => x.id === e)!.from.includes(p.state);

/** What `ps` / /proc/<pid>/status would print for the state. */
export const PS_LETTER: Record<State, string> = {
  new: "—", ready: "R (runnable)", running: "R (running)", blocked: "D (disk sleep)", zombie: "Z (zombie)", gone: "—",
};

const FILES = ["notes.txt", "data.csv", "log.txt", "config.ini"];

export function apply(p: Proc, e: EventId): { p: Proc; text: string } {
  if (!allowed(p, e)) return { p, text: "That event can't happen in this state." };
  const q: Proc = { ...p, fds: [...p.fds] };
  switch (e) {
    case "admit":
      q.state = "ready";
      return { p: q, text: "The kernel has built the process record, page table and stack. It joins the run queue: ready, but not running yet." };
    case "dispatch":
      q.state = "running";
      return { p: q, text: `The scheduler loads its saved registers. PC = 0x${q.pc.toString(16)}; the CPU runs its instructions now.` };
    case "preempt":
      q.state = "ready"; q.cpuMs += 4; q.pc += 0x2c0; q.switches++;
      return { p: q, text: "A 4 ms time slice is used up. The kernel saves its registers and puts it back in the run queue. Nothing is lost." };
    case "read":
      q.state = "blocked"; q.cpuMs += 1; q.pc += 0x40; q.switches++;
      return { p: q, text: "It calls read() and the data isn't in memory. It can't continue, so the kernel takes it off the CPU until the disk answers." };
    case "ioDone":
      q.state = "ready";
      return { p: q, text: "The disk raises an interrupt. The data is copied in and the process goes back to the run queue (ready, not running)." };
    case "open": {
      if (q.fds.length >= 3 + FILES.length) return { p, text: "This demo stops at four open files." };
      const fd = q.fds.length;
      q.fds.push({ fd, what: FILES[fd - 3] }); q.pc += 0x18;
      return { p: q, text: `open() succeeds and returns fd ${fd}, the lowest free number. The kernel adds a row to this process's file table.` };
    }
    case "malloc":
      q.heapKb += 1024; q.pc += 0x10;
      return { p: q, text: `The heap grows by 1 MB to ${(q.heapKb / 1024).toFixed(1)} MB. Other processes can't see it: each has its own address space.` };
    case "exit":
      q.state = "zombie"; q.exitCode = 0; q.cpuMs += 1; q.fds = []; q.heapKb = 0;
      return { p: q, text: "It calls exit(0). The kernel frees its memory and closes its files, but keeps a small record with the exit code until the parent asks for it." };
    case "reap":
      q.state = "gone";
      return { p: q, text: `The parent (PID ${q.ppid}) calls wait() and gets exit code 0. Now the last record is removed and PID ${q.pid} can be reused.` };
  }
}
