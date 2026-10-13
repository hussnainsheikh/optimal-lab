// TCP congestion control. The sender limits data in flight to a congestion window (cwnd),
// counted in packets. Slow start doubles it every round trip; after the threshold it grows by
// one (congestion avoidance). On a loss, Reno halves it; Tahoe drops back to 1.

export type Algo = "reno" | "tahoe";
export type Round = { rtt: number; cwnd: number; phase: "slow start" | "avoidance" | "loss"; ssthresh: number };

export function simulate(algo: Algo, lossAt: number | null, rounds = 24): Round[] {
  const out: Round[] = [];
  let cwnd = 1;
  let ssthresh = 16;
  for (let r = 0; r < rounds; r++) {
    if (lossAt !== null && r === lossAt) {
      out.push({ rtt: r, cwnd, phase: "loss", ssthresh });
      ssthresh = Math.max(2, Math.floor(cwnd / 2));
      cwnd = algo === "reno" ? ssthresh : 1;
      continue;
    }
    out.push({ rtt: r, cwnd, phase: cwnd < ssthresh ? "slow start" : "avoidance", ssthresh });
    cwnd = cwnd < ssthresh ? Math.min(cwnd * 2, ssthresh) : cwnd + 1;
  }
  return out;
}

export const sent = (rounds: Round[]) => rounds.reduce((s, r) => s + r.cwnd, 0);
