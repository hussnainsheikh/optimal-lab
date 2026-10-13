// A spam classifier's scores on 20 emails. Move the threshold and watch precision and recall trade off.
export const ITEMS = [
  [0.97, 1], [0.94, 1], [0.91, 1], [0.88, 0], [0.85, 1], [0.81, 1], [0.77, 0], [0.73, 1], [0.69, 1], [0.64, 0],
  [0.58, 1], [0.52, 0], [0.47, 0], [0.43, 1], [0.36, 0], [0.31, 0], [0.24, 0], [0.18, 1], [0.11, 0], [0.05, 0],
].map(([score, spam], i) => ({ id: i, score, spam: spam === 1 }));
export function metrics(t: number) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const x of ITEMS) { const pred = x.score >= t; if (pred && x.spam) tp++; else if (pred) fp++; else if (x.spam) fn++; else tn++; }
  const precision = tp + fp ? tp / (tp + fp) : 1, recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { tp, fp, fn, tn, precision, recall, f1, accuracy: (tp + tn) / ITEMS.length };
}
