// A producer at 120 msg/s feeding a consumer that handles 80 msg/s.
export type Mode = "unbounded" | "drop" | "backpressure";
export const MODES: { id: Mode; label: string }[] = [
  { id: "unbounded", label: "Unbounded queue" },
  { id: "drop", label: "Bounded, drop new" },
  { id: "backpressure", label: "Bounded, slow the producer" },
];
export const PRODUCE = 120, CONSUME = 80, CAP = 200, SECONDS = 20;

export function run(m: Mode) {
  let q = 0, dropped = 0, sent = 0;
  const ticks = Array.from({ length: SECONDS }, (_, t) => {
    let incoming = PRODUCE;
    if (m === "backpressure") incoming = Math.min(PRODUCE, CAP - q + CONSUME);
    q += incoming; sent += incoming;
    if (m === "drop" && q > CAP) { dropped += q - CAP; q = CAP; }
    q = Math.max(0, q - CONSUME);
    return { t: t + 1, queue: q, rate: incoming, latency: q / CONSUME };
  });
  return { ticks, dropped, sent, final: ticks[ticks.length - 1] };
}
