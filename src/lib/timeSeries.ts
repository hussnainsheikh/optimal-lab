// Time-series databases: metrics arrive as (series, timestamp, value) points, append-only.
// The arithmetic is real: points per second from hosts × metrics ÷ interval; series from
// metrics × label values (cardinality); bytes from a per-point cost; retention tiers from
// downsampling. Gorilla's compression figure (1.37 bytes per point on average, against
// 16 bytes raw) is from the Facebook paper (Pelkonen et al. 2015).

export const RAW_BYTES = 16; // 8-byte timestamp + 8-byte float
export const GORILLA_BYTES = 1.37;

export const HOSTS = [100, 1000, 10000];
export const METRICS_PER_HOST = 50;
export const INTERVALS = [1, 10, 60]; // seconds

export type Tier = { label: string; interval: number; days: number };
export const TIERS: Tier[] = [
  { label: "raw", interval: 0, days: 7 }, // interval 0 = as scraped
  { label: "1-minute rollups", interval: 60, days: 90 },
  { label: "1-hour rollups", interval: 3600, days: 730 },
];

export const CARDINALITY_LABELS = [
  { id: "none", label: "host only", factor: 1 },
  { id: "endpoint", label: "+ endpoint (20 values)", factor: 20 },
  { id: "user", label: "+ user id (10,000 values)", factor: 10000 },
];

export type Settings = { hosts: number; interval: number; compress: boolean; downsample: boolean; cardinality: string };

export type Result = {
  series: number;
  pointsPerSec: number;
  bytesPerPoint: number;
  rawPerDay: number; // bytes
  tiers: { label: string; bytes: number; days: number; pointsPerSeriesPerDay: number }[];
  total: number; // bytes kept
  twoYearsRaw: number; // bytes if raw were kept for two years
};

export function compute(s: Settings): Result {
  const factor = CARDINALITY_LABELS.find((c) => c.id === s.cardinality)!.factor;
  const series = s.hosts * METRICS_PER_HOST * factor;
  const pointsPerSec = series / s.interval;
  const bytesPerPoint = s.compress ? GORILLA_BYTES : RAW_BYTES;
  const rawPerDay = pointsPerSec * 86400 * bytesPerPoint;
  const tiers = TIERS.filter((t) => s.downsample || t.interval === 0).map((t) => {
    const interval = t.interval === 0 ? s.interval : Math.max(t.interval, s.interval);
    const pointsPerSeriesPerDay = 86400 / interval;
    const days = s.downsample ? t.days : 730;
    return { label: t.label, days, pointsPerSeriesPerDay, bytes: series * pointsPerSeriesPerDay * bytesPerPoint * days };
  });
  return { series, pointsPerSec, bytesPerPoint, rawPerDay, tiers, total: tiers.reduce((a, t) => a + t.bytes, 0), twoYearsRaw: rawPerDay * 730 };
}

// A query: p95 of one metric across all hosts over a range. Points scanned depends on
// which tier the range falls in.
export const RANGES = [
  { id: "1h", label: "last hour", seconds: 3600 },
  { id: "1d", label: "last day", seconds: 86400 },
  { id: "30d", label: "last 30 days", seconds: 30 * 86400 },
  { id: "1y", label: "last year", seconds: 365 * 86400 },
];

export function scanned(s: Settings, rangeSeconds: number): { points: number; tier: string } {
  const factor = CARDINALITY_LABELS.find((c) => c.id === s.cardinality)!.factor;
  const seriesForMetric = s.hosts * factor;
  const days = rangeSeconds / 86400;
  const tier = !s.downsample ? TIERS[0] : TIERS.find((t) => days <= t.days) ?? TIERS[TIERS.length - 1];
  const interval = tier.interval === 0 ? s.interval : Math.max(tier.interval, s.interval);
  return { points: seriesForMetric * (rangeSeconds / interval), tier: tier.label };
}

export const SCAN_RATE = 20e6; // points per second a query engine can process

export function bytes(n: number): string {
  if (n >= 1e15) return `${(n / 1e15).toFixed(1)} PB`;
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)} TB`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} MB`;
  return `${Math.round(n / 1e3)} KB`;
}

export function count(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} billion`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} million`;
  if (n >= 1e3) return `${Math.round(n / 1e3).toLocaleString("en-US")}k`;
  return String(Math.round(n));
}

export const secs = (s: number) => (s >= 60 ? `${(s / 60).toFixed(1)} min` : s >= 1 ? `${s.toFixed(1)} s` : `${Math.round(s * 1000)} ms`);
