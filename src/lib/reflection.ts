// Reflection: draft, get feedback, revise, repeat.
// The task is a slugify function checked by 8 tests (stated here as input → output,
// no code). The draft passes 4. Each round the model revises with some feedback;
// per test, a failing test gets fixed with probability FIX and a passing test gets
// broken with probability BREAK. What changes between modes is the feedback:
//  - self:   the model re-reads its own answer. It can't tell which cases fail, so it
//            fixes little and sometimes "fixes" what worked (Huang et al. 2023).
//  - tests:  your harness runs the tests and says which ones fail.
//  - errors: the failing tests plus expected vs actual output (as in Reflexion,
//            Shinn et al. 2023, and every coding agent's test loop).

export type Test = { input: string; expected: string; draft: string };

export const TESTS: Test[] = [
  { input: "Hello World", expected: "hello-world", draft: "hello-world" },
  { input: "  trim me  ", expected: "trim-me", draft: "-trim-me-" },
  { input: "Café au lait", expected: "cafe-au-lait", draft: "caf-au-lait" },
  { input: "a--b", expected: "a-b", draft: "a--b" },
  { input: "C++ & Rust!", expected: "c-rust", draft: "c----rust-" },
  { input: "", expected: "", draft: "" },
  { input: "Already-slug", expected: "already-slug", draft: "already-slug" },
  { input: "Many   spaces", expected: "many-spaces", draft: "many-spaces" },
];

export type Mode = "self" | "tests" | "errors";

export const MODES: { id: Mode; label: string; fix: number; brk: number; critique: string }[] = [
  {
    id: "self",
    label: "Self-critique only",
    fix: 0.12,
    brk: 0.08,
    critique: "Looking at my function again, it lowercases, replaces spaces with hyphens and should handle punctuation. I'll tidy the regex to be safe.",
  },
  {
    id: "tests",
    label: "Run the tests",
    fix: 0.55,
    brk: 0.04,
    critique: "4 of 8 tests fail: “  trim me  ”, “Café au lait”, “a--b”, “C++ & Rust!”. I'll look at what those inputs have in common.",
  },
  {
    id: "errors",
    label: "Tests + error output",
    fix: 0.8,
    brk: 0.03,
    critique: "“  trim me  ” gave “-trim-me-”: strip the ends. “Café” gave “caf”: remove accents before dropping symbols. “a--b” and “C++ & Rust!”: collapse repeated hyphens.",
  },
];

export const MAX_ROUNDS = 4;
const draftPass = TESTS.map((t) => t.draft === t.expected);
export const DRAFT_PASSING = draftPass.filter(Boolean).length;

// Expected tests passing after each round (round 0 = the draft).
export function expectedCurve(mode: Mode): number[] {
  const m = MODES.find((x) => x.id === mode)!;
  const out: number[] = [];
  let p: number[] = draftPass.map((x) => (x ? 1 : 0)); // chance each test passes
  for (let r = 0; r <= MAX_ROUNDS; r++) {
    out.push(p.reduce((a, b) => a + b, 0));
    p = p.map((x) => x * (1 - m.brk) + (1 - x) * m.fix);
  }
  return out;
}

// Picked so the single run looks like the expected curve for each mode.
export const SEED = 11;

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One seeded run: which tests pass after each round. The same random numbers are
// used for every mode, so the modes differ only by their feedback.
export function run(mode: Mode, seed = SEED): boolean[][] {
  const m = MODES.find((x) => x.id === mode)!;
  const rand = rng(seed);
  const rounds: boolean[][] = [draftPass];
  for (let r = 1; r <= MAX_ROUNDS; r++) {
    const prev = rounds[r - 1];
    if (mode !== "self" && prev.every(Boolean)) {
      rounds.push(prev); // tests pass: the harness stops revising
      continue;
    }
    rounds.push(prev.map((pass) => (pass ? rand() >= m.brk : rand() < m.fix)));
  }
  return rounds;
}

export const passing = (row: boolean[]) => row.filter(Boolean).length;
