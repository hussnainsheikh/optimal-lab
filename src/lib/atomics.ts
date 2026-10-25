// Updating shared memory without a lock. Threads increment one shared counter, and their
// instructions are interleaved one at a time in a random order (the way they really overlap
// when two cores run at once). Four ways to write the increment:
// - plain:   load x into a register, add 1, store it back. Another thread can store in between,
//            and its update is overwritten (lost).
// - fetch_add: one atomic read-modify-write instruction (LOCK XADD on x86, LDADD on ARM).
// - CAS loop: load x, then compare-and-swap(x, old, old+1), which only writes if x still holds
//            old; if someone changed it, load again and retry.
// - lock:    test-and-set a lock word (spinning while it's taken), then a plain increment, then
//            release.
// The ABA trace runs a lock-free (Treiber) stack where a CAS can't tell that the top changed and
// changed back. Costs in nanoseconds are illustrative orders of magnitude.

export type Method = "plain" | "fetchAdd" | "cas" | "lock";
export const METHODS: Method[] = ["plain", "fetchAdd", "cas", "lock"];
export const METHOD_LABEL: Record<Method, string> = { plain: "x = x + 1", fetchAdd: "fetch_add", cas: "CAS loop", lock: "Spinlock" };
export const METHOD_CODE: Record<Method, string[]> = {
  plain: ["r = load(x)", "r = r + 1", "store(x, r)"],
  fetchAdd: ["fetch_add(x, 1)   // one atomic instruction"],
  cas: ["old = load(x)", "if !CAS(x, old, old + 1): goto 1"],
  lock: ["while test_and_set(lock): spin", "r = load(x)", "store(x, r + 1)", "store(lock, 0)"],
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type TraceStep = { thread: number; text: string; x: number; bad?: boolean };
export type CountResult = { expected: number; final: number; lost: number; retries: number; spins: number; instructions: number; trace: TraceStep[] };

export function count(method: Method, threads: number, each: number, seed = 3, keep = 0): CountResult {
  const r = rng(seed);
  let x = 0;
  let lock = 0;
  const pc = Array(threads).fill(0);
  const reg = Array(threads).fill(0);
  const done = Array(threads).fill(0);
  let retries = 0, spins = 0, instructions = 0;
  const trace: TraceStep[] = [];
  const log = (thread: number, text: string, bad = false) => { if (trace.length < keep) trace.push({ thread, text, x, bad }); };

  while (done.some((d) => d < each)) {
    const live = done.map((d, i) => (d < each ? i : -1)).filter((i) => i >= 0);
    const t = live[Math.floor(r() * live.length)];
    instructions++;
    if (method === "plain") {
      if (pc[t] === 0) { reg[t] = x; pc[t] = 1; log(t, `r = load(x) → ${reg[t]}`); }
      else if (pc[t] === 1) { reg[t]++; pc[t] = 2; log(t, `r = r + 1 → ${reg[t]}`); }
      else { const lost = x !== reg[t] - 1; x = reg[t]; pc[t] = 0; done[t]++; log(t, `store(x, ${reg[t]})${lost ? " overwrites another update" : ""}`, lost); }
    } else if (method === "fetchAdd") {
      x++; done[t]++; log(t, `fetch_add(x, 1): ${x - 1} → ${x}`);
    } else if (method === "cas") {
      if (pc[t] === 0) { reg[t] = x; pc[t] = 1; log(t, `old = load(x) → ${reg[t]}`); }
      else if (x === reg[t]) { x = reg[t] + 1; pc[t] = 0; done[t]++; log(t, `CAS(x, ${reg[t]}, ${reg[t] + 1}) succeeds`); }
      else { retries++; pc[t] = 0; log(t, `CAS(x, ${reg[t]}, ${reg[t] + 1}) fails: x is ${x}, retry`, true); }
    } else {
      if (pc[t] === 0) {
        if (lock === 0) { lock = t + 1; pc[t] = 1; log(t, "test_and_set(lock) → got it"); }
        else { spins++; log(t, "test_and_set(lock) → taken, spin"); }
      } else if (pc[t] === 1) { reg[t] = x; pc[t] = 2; log(t, `r = load(x) → ${reg[t]}`); }
      else if (pc[t] === 2) { x = reg[t] + 1; pc[t] = 3; log(t, `store(x, ${x})`); }
      else { lock = 0; pc[t] = 0; done[t]++; log(t, "store(lock, 0)"); }
    }
  }
  const expected = threads * each;
  return { expected, final: x, lost: expected - x, retries, spins, instructions, trace };
}

// ABA on a Treiber stack. Nodes are reused (the allocator hands A's memory straight back).
export type Stack = { top: string | null; ver: number; next: Record<string, string | null>; freed: string[] };
export type AbaStep = { who: "T1" | "T2"; text: string; stack: Stack; bad?: boolean; good?: boolean };

export function aba(tagged: boolean): AbaStep[] {
  const s: Stack = { top: "A", ver: 0, next: { A: "B", B: "C", C: null }, freed: [] };
  const snap = (): Stack => ({ ...s, next: { ...s.next }, freed: [...s.freed] });
  const steps: AbaStep[] = [];
  const say = (who: "T1" | "T2", text: string, extra: Partial<AbaStep> = {}) => steps.push({ who, text, stack: snap(), ...extra });

  // T1 starts pop(): reads the top and its next, then is preempted before the CAS
  const seenTop = s.top, seenVer = s.ver, seenNext = s.next[s.top!];
  say("T1", `pop(): top is ${seenTop}${tagged ? ` (version ${seenVer})` : ""}, its next is ${seenNext}. Preempted before the CAS.`);
  // T2 pops A and B, frees B, then pushes A back
  const pop = () => { const n = s.top!; s.top = s.next[n]; s.ver++; return n; };
  say("T2", `pop() → ${pop()}`);
  const b = pop();
  s.freed.push(b);
  say("T2", `pop() → ${b}, and frees ${b}`);
  s.next.A = s.top; s.top = "A"; s.ver++;
  say("T2", "push(A): A's memory is reused, so the top is A again");
  // T1 resumes: CAS(top, A, B)
  const same = tagged ? s.top === seenTop && s.ver === seenVer : s.top === seenTop;
  if (same) {
    s.top = seenNext;
    s.ver++;
    say("T1", `CAS(top, ${seenTop}, ${seenNext}) succeeds: the top was A, so nothing looked changed. The top is now ${seenNext}, which was freed. A and its link to C are lost.`, { bad: true });
  } else {
    say("T1", `CAS(top, (A, v${seenVer}), …) fails: the top is A but at version ${s.ver}. Retry.`);
    const t = s.top!, n = s.next[t];
    s.top = n; s.ver++;
    say("T1", `pop(): top is ${t}, next is ${n}; CAS succeeds. The stack is correct.`, { good: true });
  }
  return steps;
}

export function stackList(s: Stack) {
  const out: string[] = [];
  for (let n = s.top, guard = 0; n && guard < 6; n = s.next[n] ?? null, guard++) out.push(n);
  return out;
}

// Throughput of increments on a shared counter as threads are added, in millions per second.
// One cache line can only be owned by one core at a time, so every update to it moves it
// between cores (~40 ns). Per-thread counters (summed when read) never share a line.
export type CostMethod = Method | "sharded";
export function mops(m: CostMethod, threads: number) {
  if (m === "sharded") return 200 * threads;
  if (m === "plain") return 1000 * threads; // fast, and wrong
  if (threads === 1) return m === "fetchAdd" ? 200 : m === "cas" ? 150 : 50;
  if (m === "fetchAdd") return 25;
  if (m === "cas") return 25 / (1 + 0.3 * (threads - 1));
  return 10;
}
