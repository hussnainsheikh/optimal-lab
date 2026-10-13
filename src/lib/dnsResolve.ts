// DNS resolution, hop by hop, for api.shop.example. With a cold cache the recursive resolver
// asks the root, then the .example servers, then shop.example's own servers. With a warm
// cache it already knows the answer and replies at once.

export type Hop = { who: string; asks: string; answer: string; ms: number };

export const NAME = "api.shop.example";

export function resolve(warm: boolean): Hop[] {
  const start: Hop[] = [
    { who: "Browser cache", asks: NAME, answer: "not cached", ms: 0 },
    { who: "Operating system", asks: NAME, answer: "not cached", ms: 0 },
  ];
  if (warm) return [...start, { who: "Recursive resolver (your ISP or 1.1.1.1)", asks: NAME, answer: "cached: 203.0.113.10 (TTL 240 s left)", ms: 8 }];
  return [
    ...start,
    { who: "Recursive resolver (your ISP or 1.1.1.1)", asks: NAME, answer: "not cached: I'll find out", ms: 8 },
    { who: "Root server", asks: NAME, answer: "ask the .example servers: a.nic.example", ms: 25 },
    { who: ".example TLD server", asks: NAME, answer: "ask shop.example's servers: ns1.shop.example", ms: 30 },
    { who: "ns1.shop.example (authoritative)", asks: NAME, answer: "A 203.0.113.10, TTL 300 s", ms: 40 },
  ];
}
