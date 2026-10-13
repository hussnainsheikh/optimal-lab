// Typical access times, and the same times scaled so that one CPU cycle (~0.3 ns) is one second.
export const LEVELS = [
  { name: "CPU register", ns: 0.3, size: "~1 KB" },
  { name: "L1 cache", ns: 1, size: "64 KB" },
  { name: "L2 cache", ns: 4, size: "1 MB" },
  { name: "L3 cache", ns: 15, size: "32 MB" },
  { name: "RAM", ns: 100, size: "16–512 GB" },
  { name: "NVMe SSD read", ns: 100_000, size: "TBs" },
  { name: "Datacenter round trip", ns: 500_000, size: "—" },
  { name: "Hard disk seek", ns: 10_000_000, size: "TBs" },
  { name: "Internet round trip (EU↔US)", ns: 80_000_000, size: "—" },
];
export function human(ns: number) {
  const s = ns / 0.3;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} seconds`;
  if (s < 3600) return `${(s / 60).toFixed(0)} minutes`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} hours`;
  if (s < 86400 * 365) return `${(s / 86400).toFixed(0)} days`;
  return `${(s / 86400 / 365).toFixed(1)} years`;
}
export function real(ns: number) {
  if (ns < 1000) return `${ns} ns`;
  if (ns < 1e6) return `${ns / 1000} µs`;
  return `${ns / 1e6} ms`;
}
