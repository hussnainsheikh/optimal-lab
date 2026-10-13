// Model confidence vs correctness on 24 extracted invoices.
export const ITEMS = [
  [0.99, 1], [0.98, 1], [0.98, 1], [0.97, 1], [0.97, 1], [0.96, 1], [0.95, 0], [0.95, 1],
  [0.93, 1], [0.92, 1], [0.91, 1], [0.9, 0], [0.88, 1], [0.86, 1], [0.84, 0], [0.82, 1],
  [0.8, 1], [0.77, 0], [0.74, 1], [0.7, 0], [0.66, 1], [0.6, 0], [0.55, 0], [0.5, 0],
].map(([confidence, correct], i) => ({ id: i + 1, confidence, correct: correct === 1 }));

export function route(threshold: number) {
  const auto = ITEMS.filter((x) => x.confidence >= threshold);
  const human = ITEMS.filter((x) => x.confidence < threshold);
  const slipped = auto.filter((x) => !x.correct).length;
  return { auto: auto.length, human: human.length, slipped, caught: human.filter((x) => !x.correct).length, automationRate: auto.length / ITEMS.length };
}
