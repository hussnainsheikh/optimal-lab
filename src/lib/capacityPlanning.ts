// A web service at 2,000 requests a second on average today. Forecast twelve months
// of growth, size the fleet for the daily peak with headroom and a lost zone, find
// the month the database becomes the wall, and price three ways to pay for it.

export const BASE_RPS = 2000; // average today
export const GROWTH = [0.02, 0.05, 0.1]; // per month
export const PEAK_FACTOR = 2.5; // busiest hour ÷ daily average
export const TROUGH_FACTOR = 0.35; // quietest hour ÷ daily average
export const INSTANCE_RPS = 400; // one instance flat out
export const UTIL_TARGETS = [0.5, 0.7, 0.9];
export const ZONES = 3;
export const DB_CEILING_RPS = 6000; // requests a second the primary database can serve
export const LEAD_MONTHS = 3; // to add read replicas or shard
export const HORIZON = 12;
export const ON_DEMAND = 0.2; // $ an instance-hour
export const RESERVED = 0.12; // $ an instance-hour, 1-year commitment, paid every hour
export const HOURS_PER_MONTH = 730;
export const SCALE_IN_COOLDOWN_H = 1; // the autoscaler waits an hour before removing instances

export type Strategy = "peakYear" | "peakMonth" | "reservedAuto";
export const STRATEGIES: { id: Strategy; label: string; one: string }[] = [
  { id: "peakYear", label: "Buy for next year's peak", one: "One fleet sized for month 12's busiest hour, on demand, all year." },
  { id: "peakMonth", label: "Resize monthly for the peak", one: "Each month, enough on-demand instances for that month's busiest hour, all day." },
  { id: "reservedAuto", label: "Reserve the trough, autoscale the rest", one: "Reserved instances for the quietest hour; on-demand instances added and removed with the daily curve." },
];

export type Settings = { growth: number; util: number; zoneSafe: boolean; strategy: Strategy; month: number };
export const START: Settings = { growth: 0.05, util: 0.7, zoneSafe: true, strategy: "peakMonth", month: 6 };

// Hour-by-hour shape of a day: quiet at 04:00, busiest at 20:00, averaging 1.
export function dayShape(): number[] {
  const raw = Array.from({ length: 24 }, (_, h) => {
    const x = Math.cos(((h - 20) / 24) * 2 * Math.PI); // 1 at 20:00, −1 at 08:00
    const y = Math.cos(((h - 4) / 24) * 2 * Math.PI); // dip at 04:00
    return 1 + 0.75 * x - 0.35 * Math.max(0, y);
  });
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  // rescale so trough = TROUGH_FACTOR and peak = PEAK_FACTOR, then normalise the mean to 1
  const scaled = raw.map((v) => TROUGH_FACTOR + ((v - min) / (max - min)) * (PEAK_FACTOR - TROUGH_FACTOR));
  const mean = scaled.reduce((a, b) => a + b, 0) / 24;
  return scaled.map((v) => v / mean);
}

export const avgRps = (growth: number, month: number) => BASE_RPS * Math.pow(1 + growth, month);

// Instances to serve `rps` at the utilisation target, rounded up to whole zones, and
// with a spare zone's worth if the fleet must survive losing one.
export function instancesFor(rps: number, util: number, zoneSafe: boolean): number {
  const raw = Math.ceil(rps / (INSTANCE_RPS * util));
  const perZone = Math.ceil(raw / (zoneSafe ? ZONES - 1 : ZONES));
  return perZone * ZONES;
}

export type MonthRow = { month: number; avg: number; peak: number; instances: number; overCeiling: boolean };
export function forecast(s: Settings): MonthRow[] {
  const shape = dayShape();
  const peakMult = Math.max(...shape);
  return Array.from({ length: HORIZON + 1 }, (_, m) => {
    const avg = avgRps(s.growth, m);
    const peak = avg * peakMult;
    return { month: m, avg, peak, instances: instancesFor(peak, s.util, s.zoneSafe), overCeiling: peak > DB_CEILING_RPS };
  });
}

export function wallMonth(s: Settings): number | null {
  const row = forecast(s).find((r) => r.overCeiling);
  return row ? row.month : null;
}

export type Cost = { paidHours: number; neededHours: number; cost: number; idleShare: number };

// One month's bill under a strategy.
export function monthCost(s: Settings, month: number): Cost {
  const shape = dayShape();
  const avg = avgRps(s.growth, month);
  const hourly = shape.map((m) => instancesFor(avg * m, s.util, s.zoneSafe));
  const days = HOURS_PER_MONTH / 24;
  const neededHours = hourly.reduce((a, b) => a + b, 0) * days;
  let paidHours: number;
  let cost: number;
  if (s.strategy === "peakYear") {
    const n = forecast(s)[HORIZON].instances;
    paidHours = n * HOURS_PER_MONTH;
    cost = paidHours * ON_DEMAND;
  } else if (s.strategy === "peakMonth") {
    const n = Math.max(...hourly);
    paidHours = n * HOURS_PER_MONTH;
    cost = paidHours * ON_DEMAND;
  } else {
    const base = Math.min(...hourly);
    // Scaling out is immediate; scaling in waits for the cooldown, so each hour pays for the larger of this hour and the last.
    const running = hourly.map((n, h) => Math.max(n, ...Array.from({ length: SCALE_IN_COOLDOWN_H }, (_, k) => hourly[(h - k - 1 + 24) % 24])));
    const burst = running.reduce((a, n) => a + (n - base), 0) * days;
    paidHours = base * HOURS_PER_MONTH + burst;
    cost = base * HOURS_PER_MONTH * RESERVED + burst * ON_DEMAND;
  }
  return { paidHours, neededHours, cost, idleShare: 1 - neededHours / paidHours };
}

export function yearCost(s: Settings): number {
  let total = 0;
  for (let m = 1; m <= HORIZON; m++) total += monthCost(s, m).cost;
  return total;
}

export function money(v: number): string {
  return v >= 10000 ? `$${Math.round(v / 1000).toLocaleString("en-US")}k` : `$${Math.round(v).toLocaleString("en-US")}`;
}
export function rps(v: number): string {
  return Math.round(v).toLocaleString("en-US");
}
