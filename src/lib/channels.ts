// Share memory by communicating. Two producers send orders to one inventory process that owns
// the stock count; nobody else touches it, so there are no locks. Messages go through:
// - an actor's mailbox (Erlang, Akka, Orleans): sends never block, the mailbox just grows;
// - an unbuffered channel (Go, CSP): a send waits until the receiver takes it;
// - a buffered channel: a send waits only when the buffer is full.
// The receiver handles one message every 10 ms; the producers together send one every 4 ms
// for 200 ms. A "bad" message can crash the receiver: unsupervised, it's gone and every later
// message is lost; supervised, it restarts in 5 ms with fresh state and keeps its mailbox (the
// message that crashed it is dropped), as in Akka's restart strategy.
// The deadlock check runs two processes that each send to the other first and reports when
// every process is blocked, like Go's "all goroutines are asleep". Simulated per millisecond.

export type Mode = "mailbox" | "unbuffered" | "buffered";
export const MODES: Mode[] = ["mailbox", "unbuffered", "buffered"];
export const MODE_LABEL: Record<Mode, string> = { mailbox: "Actor mailbox", unbuffered: "Unbuffered channel", buffered: "Buffered channel (4)" };
export const BUFFER = 4;
export const HANDLE_MS = 10;
export const SEND_EVERY = 4; // ms between sends, both producers together
export const SEND_FOR = 200;
export const RESTART_MS = 5;
export const BAD_AT = 60; // the bad message is sent at this time

export type Msg = { id: number; from: string; sentAt: number; queuedAt: number; doneAt: number; bad: boolean; lost: boolean };
export type Result = {
  msgs: Msg[];
  queue: { t: number; len: number }[]; // every 5 ms
  peakQueue: number;
  producerBlocked: number; // ms the producers spent blocked on send
  handled: number; lost: number;
  p50: number; max: number; // send → handled
  end: number; crashedAt: number | null; restarts: number;
  stock: number; // the state only the receiver touches
};

export function simulate(mode: Mode, opts: { bad: boolean; supervised: boolean }): Result {
  const cap = mode === "mailbox" ? Infinity : mode === "buffered" ? BUFFER : 0;
  const plan: { at: number; from: string }[] = [];
  for (let t = 0, i = 0; t < SEND_FOR; t += SEND_EVERY, i++) plan.push({ at: t, from: i % 2 ? "web" : "app" });
  const msgs: Msg[] = [];
  const queue: Msg[] = [];
  const pending: Msg[] = []; // a producer blocked holding its message (unbuffered or full)
  let next = 0, busyUntil = -1, current: Msg | null = null;
  let alive = true, crashedAt: number | null = null, restarts = 0, restartAt = -1;
  let producerBlocked = 0, stock = 1000, peakQueue = 0;
  const series: Result["queue"] = [];
  let now = 0;

  for (; now < 3000; now++) {
    // producers try to send; a blocked one keeps its message and waits
    while (next < plan.length && plan[next].at <= now) {
      const m: Msg = { id: next, from: plan[next].from, sentAt: plan[next].at, queuedAt: -1, doneAt: -1, bad: opts.bad && plan[next].at >= BAD_AT && plan[next].at < BAD_AT + SEND_EVERY, lost: false };
      msgs.push(m);
      pending.push(m);
      next++;
    }
    // the receiver finishes its current message
    if (current && now >= busyUntil) {
      if (current.bad) {
        current.lost = true; // the message that crashed it is dropped
        alive = false;
        if (opts.supervised) { restarts++; restartAt = now + RESTART_MS; stock = 1000; } // restarted with fresh state
        else crashedAt = now;
      } else {
        current.doneAt = now;
        stock--;
      }
      current = null;
    }
    if (!alive && opts.supervised && now >= restartAt && restartAt >= 0) { alive = true; restartAt = -1; }
    // senders hand over: into the mailbox/buffer if there's room, or directly to a waiting receiver
    const receiverWaiting = alive && !current && queue.length === 0;
    while (pending.length) {
      const m = pending[0];
      if (crashedAt !== null) { m.lost = true; pending.shift(); continue; } // nobody will ever receive it
      if (queue.length < cap) { queue.push(m); m.queuedAt = now; pending.shift(); continue; }
      if (cap === 0 && receiverWaiting && !current) { queue.push(m); m.queuedAt = now; pending.shift(); break; } // rendezvous
      break;
    }
    producerBlocked += pending.length ? 1 : 0;
    // the receiver takes the next message
    if (alive && !current && queue.length) { current = queue.shift()!; busyUntil = now + HANDLE_MS; }
    if (crashedAt !== null) for (const m of queue.splice(0)) m.lost = true;
    peakQueue = Math.max(peakQueue, queue.length);
    if (now % 5 === 0) series.push({ t: now, len: queue.length });
    if (next >= plan.length && !pending.length && !queue.length && !current && (alive || crashedAt !== null)) break;
  }

  const lat = msgs.filter((m) => m.doneAt >= 0).map((m) => m.doneAt - m.sentAt).sort((a, b) => a - b);
  return {
    msgs,
    queue: series,
    peakQueue,
    producerBlocked,
    handled: lat.length,
    lost: msgs.filter((m) => m.lost).length,
    p50: lat.length ? lat[Math.ceil(lat.length / 2) - 1] : 0,
    max: lat.length ? lat[lat.length - 1] : 0,
    end: now,
    crashedAt,
    restarts,
    stock,
  };
}

// Two processes that each send to the other, then receive. With unbuffered channels both block
// on their send forever; with a buffer of 1 both sends go through.
export type DlStep = { who: string; does: string; blocked: boolean };
export function deadlock(capacity: number) {
  const chan: Record<string, number> = { toB: 0, toA: 0 };
  const prog: Record<string, { op: "send" | "recv"; ch: string }[]> = {
    A: [{ op: "send", ch: "toB" }, { op: "recv", ch: "toA" }],
    B: [{ op: "send", ch: "toA" }, { op: "recv", ch: "toB" }],
  };
  const pc: Record<string, number> = { A: 0, B: 0 };
  const steps: DlStep[] = [];
  for (let round = 0; round < 6; round++) {
    let moved = false;
    for (const who of ["A", "B"]) {
      const ins = prog[who][pc[who]];
      if (!ins) continue;
      const other = who === "A" ? "B" : "A";
      const otherIns = prog[other][pc[other]];
      let ok = false;
      if (ins.op === "send") ok = chan[ins.ch] < capacity || (otherIns?.op === "recv" && otherIns.ch === ins.ch);
      else ok = chan[ins.ch] > 0;
      if (ok) {
        if (ins.op === "send") { if (chan[ins.ch] < capacity) chan[ins.ch]++; else pc[other]++; }
        else chan[ins.ch]--;
        pc[who]++;
        moved = true;
        steps.push({ who, does: `${ins.op === "send" ? "send on" : "receive from"} ${ins.ch}`, blocked: false });
      } else if (!steps.some((s) => s.who === who && s.blocked && s.does.includes(ins.ch))) {
        steps.push({ who, does: `${ins.op === "send" ? "send on" : "receive from"} ${ins.ch}: waits`, blocked: true });
      }
    }
    if (!moved) break;
  }
  const finished = pc.A >= prog.A.length && pc.B >= prog.B.length;
  return { steps, deadlocked: !finished };
}
