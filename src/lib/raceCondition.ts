// A race condition: two threads each do `counter = counter + 1`, which is really three steps:
// read the shared value into a register, add one, write it back. If the steps interleave, one
// thread's write overwrites the other's and an increment is lost. A mutex makes the three
// steps one unit: the second thread waits until the first has written.

export type Thread = "A" | "B";
export type Op = "lock" | "read" | "add" | "write" | "unlock" | "wait";

export type Step = { thread: Thread; op: Op };

export type Schedule = { id: string; label: string; note: string; steps: Step[]; locked: boolean };

const inc = (t: Thread): Step[] => [
  { thread: t, op: "read" },
  { thread: t, op: "add" },
  { thread: t, op: "write" },
];

export const SCHEDULES: Schedule[] = [
  { id: "turns", label: "Taking turns", note: "A finishes before B starts. Correct, but only by luck of timing.", locked: false, steps: [...inc("A"), ...inc("B")] },
  {
    id: "interleaved",
    label: "Interleaved",
    note: "The scheduler switches threads in the middle. Both read 0.",
    locked: false,
    steps: [
      { thread: "A", op: "read" },
      { thread: "B", op: "read" },
      { thread: "A", op: "add" },
      { thread: "B", op: "add" },
      { thread: "A", op: "write" },
      { thread: "B", op: "write" },
    ],
  },
  {
    id: "mutex",
    label: "Interleaved + mutex",
    note: "Same switching, but B can't get the lock until A releases it.",
    locked: true,
    steps: [
      { thread: "A", op: "lock" },
      { thread: "A", op: "read" },
      { thread: "B", op: "wait" },
      { thread: "A", op: "add" },
      { thread: "B", op: "wait" },
      { thread: "A", op: "write" },
      { thread: "A", op: "unlock" },
      { thread: "B", op: "lock" },
      { thread: "B", op: "read" },
      { thread: "B", op: "add" },
      { thread: "B", op: "write" },
      { thread: "B", op: "unlock" },
    ],
  },
];

export type Frame = { step: Step | null; counter: number; reg: Record<Thread, number | null>; lockedBy: Thread | null; note: string };

export function run(s: Schedule): Frame[] {
  let counter = 0;
  const reg: Record<Thread, number | null> = { A: null, B: null };
  let lockedBy: Thread | null = null;
  const frames: Frame[] = [{ step: null, counter, reg: { ...reg }, lockedBy, note: "counter = 0. Each thread will add 1, so it should end at 2." }];
  for (const st of s.steps) {
    const t = st.thread;
    let note = "";
    if (st.op === "lock") {
      lockedBy = t;
      note = `${t} takes the lock.`;
    } else if (st.op === "unlock") {
      lockedBy = null;
      note = `${t} releases the lock.`;
    } else if (st.op === "wait") {
      note = `${t} tries to take the lock, but ${lockedBy} holds it. ${t} waits.`;
    } else if (st.op === "read") {
      reg[t] = counter;
      note = `${t} reads counter: ${counter}.`;
    } else if (st.op === "add") {
      reg[t] = (reg[t] ?? 0) + 1;
      note = `${t} adds 1 in its register: ${reg[t]}.`;
    } else {
      const lost = counter > (reg[t] ?? 0) - 1 && counter >= (reg[t] ?? 0);
      counter = reg[t] ?? counter;
      note = lost ? `${t} writes ${counter}, overwriting the other thread's update.` : `${t} writes ${counter}.`;
    }
    frames.push({ step: st, counter, reg: { ...reg }, lockedBy, note });
  }
  return frames;
}

// Many increments with random switching (a fixed seed so the result is stable).
export function stress(perThread: number, locked: boolean, seed = 7) {
  let x = seed;
  const rand = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  let counter = 0;
  const left: Record<Thread, number> = { A: perThread, B: perThread };
  const pc: Record<Thread, number> = { A: 0, B: 0 }; // 0 read, 1 add, 2 write
  const reg: Record<Thread, number> = { A: 0, B: 0 };
  let holder: Thread | null = null;
  while (left.A + left.B > 0) {
    const t: Thread = left.A === 0 ? "B" : left.B === 0 ? "A" : rand() < 0.5 ? "A" : "B";
    if (locked && holder && holder !== t) continue; // blocked: the other thread runs instead
    if (locked && pc[t] === 0) holder = t;
    if (pc[t] === 0) reg[t] = counter;
    else if (pc[t] === 1) reg[t] += 1;
    else {
      counter = reg[t];
      left[t]--;
      if (locked) holder = null;
    }
    pc[t] = (pc[t] + 1) % 3;
  }
  return { counter, expected: perThread * 2, lost: perThread * 2 - counter };
}
