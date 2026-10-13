// Which color does <a id="buy" class="btn primary" style="…"> get?
export type Rule = { id: string; selector: string; color: string; spec: [number, number, number, number]; important?: boolean; order: number };
export const RULES: Rule[] = [
  { id: "a", selector: "a", color: "gray", spec: [0, 0, 0, 1], order: 1 },
  { id: "btn", selector: ".btn", color: "royalblue", spec: [0, 0, 1, 0], order: 2 },
  { id: "btnp", selector: ".btn.primary", color: "seagreen", spec: [0, 0, 2, 0], order: 3 },
  { id: "id", selector: "#buy", color: "purple", spec: [0, 1, 0, 0], order: 4 },
  { id: "inline", selector: 'style="color: darkorange"', color: "darkorange", spec: [1, 0, 0, 0], order: 5 },
  { id: "imp", selector: ".btn { … !important }", color: "crimson", spec: [0, 0, 1, 0], important: true, order: 6 },
  { id: "late", selector: ".primary (declared last)", color: "teal", spec: [0, 0, 1, 0], order: 7 },
];
const cmp = (a: Rule, b: Rule) => {
  if (!!a.important !== !!b.important) return a.important ? 1 : -1;
  for (let i = 0; i < 4; i++) if (a.spec[i] !== b.spec[i]) return a.spec[i] - b.spec[i];
  return a.order - b.order;
};
export function winner(on: Set<string>) {
  const active = RULES.filter((r) => on.has(r.id));
  if (!active.length) return { rule: null as Rule | null, reason: "No rule applies: the color is inherited from the parent." };
  const sorted = [...active].sort(cmp);
  const w = sorted[sorted.length - 1], second = sorted[sorted.length - 2];
  let reason = "It's the only rule that applies.";
  if (second) {
    if (!!w.important !== !!second.important) reason = "!important beats every normal declaration, even inline styles.";
    else if (w.spec.join() !== second.spec.join()) reason = `Higher specificity: (${w.spec.join(",")}) beats (${second.spec.join(",")}).`;
    else reason = "Same specificity, so the one declared later wins.";
  }
  return { rule: w, reason };
}
