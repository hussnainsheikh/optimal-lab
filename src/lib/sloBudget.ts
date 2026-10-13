// Error budget over a 30-day window.
export const TARGETS = [99, 99.9, 99.99];
export const INCIDENTS = [
  { day: 4, minutes: 12, what: "Bad deploy, rolled back" },
  { day: 11, minutes: 6, what: "Database failover" },
  { day: 17, minutes: 25, what: "Expired TLS certificate" },
  { day: 23, minutes: 9, what: "Cache stampede" },
];
const WINDOW = 30 * 24 * 60;

export function budget(target: number) {
  const total = (WINDOW * (100 - target)) / 100;
  let used = 0;
  let exhaustedOn: number | null = null;
  const days = Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    used += INCIDENTS.filter((x) => x.day === day).reduce((a, x) => a + x.minutes, 0);
    const left = total - used;
    if (left < 0 && exhaustedOn === null) exhaustedOn = day;
    return { day, left, pct: left / total };
  });
  const availability = 100 - (used / WINDOW) * 100;
  return { total, used, left: total - used, exhaustedOn, days, availability };
}
