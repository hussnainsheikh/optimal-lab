// Why a faster connection barely helps small pages: round trips dominate.
export const SIZES = [{ name: "API call (2 KB)", kb: 2 }, { name: "Web page (500 KB)", kb: 500 }, { name: "Video (200 MB)", kb: 200000 }];
// TCP slow start: first flight 10 segments (~14 KB), doubling each round trip.
export function slowStartRounds(kb: number, bwMbps: number, rttMs: number) {
  const bdpKb = (bwMbps * 1000 / 8) * (rttMs / 1000);
  let sent = 0, win = 14, rounds = 0;
  while (sent < kb && win < bdpKb) { sent += win; win *= 2; rounds++; }
  return { rounds, remaining: Math.max(0, kb - sent), bdpKb };
}
export function time(kb: number, bwMbps: number, rttMs: number) {
  const setup = 2 * rttMs; // TCP + TLS 1.3 handshakes
  const ss = slowStartRounds(kb, bwMbps, rttMs);
  const rampup = ss.rounds * rttMs;
  const transfer = (ss.remaining * 8) / (bwMbps * 1000) * 1000;
  return { setup, rampup, transfer, total: setup + rampup + transfer, bdpKb: ss.bdpKb };
}
