// Distillation: a big teacher model labels data for a small student.
// The softmax with temperature is real (Hinton et al. 2015): logits / T, then softmax.
// A higher T spreads the probability onto the wrong-but-similar classes, which is what
// the student learns from ("dark knowledge"). The accuracy curves are a teaching model:
// a soft label carries more information per example than a hard one, so the student
// reaches its ceiling with fewer examples.

export const CLASSES = ["cat", "fox", "dog", "car"] as const;
export const LOGITS = [6.0, 3.6, 2.9, -1.5]; // the teacher's scores for one photo of a cat

export function softmax(logits: number[], T: number): number[] {
  const z = logits.map((l) => l / T);
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

// Bits of information in the distribution: 0 for a hard label, up to 2 for four equal classes.
export const entropy = (p: number[]) => -p.reduce((s, v) => s + (v > 0 ? v * Math.log2(v) : 0), 0);

export const TEMPERATURES = [1, 2, 4, 8, 20];
export const EXAMPLE_COUNTS = [500, 2000, 8000, 32000];

export type Student = { id: string; label: string; ceiling: number; price: number; tps: number };

export const TEACHER = { label: "Teacher, 70B", accuracy: 0.94, price: 15, tps: 25 }; // $ per million output tokens, tokens per second
export const STUDENTS: Student[] = [
  { id: "s1", label: "Student, 1B", ceiling: 0.8, price: 0.1, tps: 300 },
  { id: "s3", label: "Student, 3B", ceiling: 0.86, price: 0.3, tps: 180 },
  { id: "s8", label: "Student, 8B", ceiling: 0.9, price: 0.6, tps: 100 },
];

export type Target = "hard" | "soft";

// How much more one soft label teaches than one hard label, by temperature.
// Around T = 4 the similar classes show clearly; past that everything flattens.
export function gain(T: number): number {
  const peak = 3;
  const base = 1.6;
  return T <= 4 ? base + (peak - base) * ((T - 1) / 3) : Math.max(1.2, peak - (T - 4) * 0.12);
}

export function accuracy(student: Student, n: number, target: Target, T: number): number {
  const g = target === "soft" ? gain(T) : 1;
  return student.ceiling * (1 - Math.exp(-(n * g) / 9000));
}

// Cost of labelling n examples with the teacher: each example is a ~200-token answer.
export const labelCost = (n: number) => (n * 200 * TEACHER.price) / 1e6;

export const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
