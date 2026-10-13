// Monthly cost of an AI feature. Prices are examples per million tokens, not quotes.
export const MODELS = [
  { id: "small", label: "Small model", inP: 0.25, outP: 1.25 },
  { id: "mid", label: "Mid model", inP: 3, outP: 15 },
  { id: "large", label: "Large model", inP: 15, outP: 75 },
];
export function cost(o: { users: number; perUser: number; inTok: number; outTok: number; model: string; cacheHit: number }) {
  const m = MODELS.find((x) => x.id === o.model)!;
  const reqs = o.users * o.perUser * 30;
  const inputCost = (reqs * o.inTok * (1 - o.cacheHit * 0.9)) / 1e6 * m.inP;
  const outputCost = (reqs * o.outTok) / 1e6 * m.outP;
  const total = inputCost + outputCost;
  return { reqs, inputCost, outputCost, total, perUser: total / o.users, perReq: total / reqs };
}
