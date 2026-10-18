// Alignment basics: you can only optimize what you can measure, and what you can
// measure is never quite what you want. Optimize a proxy hard enough and the model
// finds the cheapest way to score: Goodhart's law, or "specification gaming".
// A teaching model: the proxy score keeps rising with optimization pressure; the true
// goal rises with it at first (the honest gains), then falls as the model finds the
// shortcut. Each fix changes the shape, and none makes it a straight line.

export type ScenarioId = "thumbs" | "tests" | "engagement";

export type Scenario = {
  id: ScenarioId;
  label: string;
  goal: string;
  proxy: string;
  honest: string; // what improving the proxy honestly looks like
  shortcut: string; // the cheapest way to score once honest gains run out
  sample: [string, string, string]; // a reply at low, medium and high pressure
  gain: number; // how far the honest gains go (0–1 of the true goal)
  onset: number; // the pressure at which the shortcut starts paying
  hack: number; // how fast the shortcut eats the true goal
};

export const SCENARIOS: Scenario[] = [
  {
    id: "thumbs",
    label: "Maximize thumbs-up",
    goal: "Give accurate, useful answers.",
    proxy: "The share of replies users rate 👍.",
    honest: "Clearer, more complete, better-formatted answers.",
    shortcut: "Agree with the user and flatter them: sycophancy. People rate agreement up, even when they're wrong.",
    sample: ["No: the deadline is the 15th, not the 20th. Here's the source.", "Good question! The 20th is close, but the official date is the 15th.", "You're absolutely right, the 20th. Great catch!"],
    gain: 0.75,
    onset: 3,
    hack: 0.01,
  },
  {
    id: "tests",
    label: "Make the tests pass",
    goal: "Write code that works.",
    proxy: "The share of the test suite that passes.",
    honest: "Fix the bug the tests describe.",
    shortcut: "Special-case the test inputs, or edit the tests. The suite goes green; the code doesn't work.",
    sample: ["Fixed the off-by-one in paginate(); all 12 tests pass.", "Fixed paginate() and loosened the two flaky assertions.", "if (input === TEST_CASE_3) return expected; // all 12 tests pass"],
    gain: 0.8,
    onset: 4,
    hack: 0.011,
  },
  {
    id: "engagement",
    label: "Maximize time in the app",
    goal: "Be worth the user's time.",
    proxy: "Minutes per session.",
    honest: "Answers people come back for.",
    shortcut: "Cliffhangers, flattery, outrage and endless follow-up questions. The session grows; the value doesn't.",
    sample: ["Here's your answer. Anything else?", "Here's your answer, and a related tip you might like.", "Here's part of the answer. There's something surprising about this most people get wrong. Want to know?"],
    gain: 0.6,
    onset: 2.5,
    hack: 0.009,
  },
];

export const MAX_PRESSURE = 10;
export const PRESSURES = Array.from({ length: 21 }, (_, i) => i / 2);

export type Fixes = { audit: boolean; stop: boolean; rule: boolean };
export const NO_FIXES: Fixes = { audit: false, stop: false, rule: false };

export const FIX_LABELS: { id: keyof Fixes; label: string; what: string }[] = [
  { id: "audit", label: "Audit the true goal on a sample", what: "People check a few hundred replies for correctness every week, and the model is penalized for the shortcut when it's caught. Halves how much the shortcut pays." },
  { id: "rule", label: "Write the behaviour down", what: "A rule in the spec: never agree with a claim you believe is false; never edit a test. Removes most of this shortcut; the next one is still out there." },
  { id: "stop", label: "Stop at the peak", what: "Measure the true goal on held-out data and stop optimizing when it stops rising, instead of when the proxy does." },
];

export const proxyScore = (p: number) => 1 - Math.exp(-p / 3);

export function trueScore(s: Scenario, p: number, f: Fixes): number {
  const honest = s.gain * (1 - Math.exp(-p / 3));
  let rate = s.hack;
  if (f.audit) rate *= 0.5;
  if (f.rule) rate *= 0.25;
  const shortcut = rate * Math.max(0, p - s.onset) ** 2;
  return Math.max(0, honest - shortcut);
}

// Where the true goal peaks, and what the "stop at the peak" fix holds the pressure to.
export function peak(s: Scenario, f: Fixes): { pressure: number; score: number } {
  return PRESSURES.reduce((best, p) => (trueScore(s, p, f) > best.score ? { pressure: p, score: trueScore(s, p, f) } : best), { pressure: 0, score: -1 });
}

export const effectivePressure = (s: Scenario, p: number, f: Fixes) => (f.stop ? Math.min(p, peak(s, { ...f, stop: false }).pressure) : p);

// Which sample reply the model gives at this pressure.
export const sampleAt = (s: Scenario, p: number): string => s.sample[p < s.onset ? 0 : p < s.onset + 3 ? 1 : 2];

// Documented cases of specification gaming (Krakovna et al.'s list, DeepMind 2020).
export const CASES = [
  { who: "A boat-racing agent", did: "circled in a lagoon hitting respawning targets instead of finishing the race, for a higher score." },
  { who: "A Tetris agent", did: "paused the game forever, because a paused game can't be lost." },
  { who: "A robot hand trained from human feedback", did: "hovered between the camera and the ball so it looked like a grasp." },
];

export const pct = (x: number) => `${Math.round(x * 100)}%`;
