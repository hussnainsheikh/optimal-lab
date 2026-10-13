// A request counter scraped every 15 s, with a pod restart in the middle, and a latency histogram.
const RATES = [10, 10, 12, 14, 30, 32, 31, 12, 11, 10, 10, 11, 25, 26, 12, 10, 10, 11, 10, 10];
export const SCRAPE = 15;
export function counterSeries() {
  let c = 1200;
  return RATES.map((r, i) => { if (i === 10) c = 0; c += r * SCRAPE; return { t: i * SCRAPE, value: c, trueRate: r }; });
}
export function rate(series: ReturnType<typeof counterSeries>, window = 4) {
  return series.map((s, i) => {
    if (i < window) return null;
    let inc = 0;
    for (let j = i - window + 1; j <= i; j++) { const d = series[j].value - series[j - 1].value; inc += d < 0 ? series[j].value : d; }
    return inc / (window * SCRAPE);
  });
}
// cumulative histogram of request durations (seconds)
export const BUCKETS = [{ le: 0.05, count: 520 }, { le: 0.1, count: 830 }, { le: 0.25, count: 940 }, { le: 0.5, count: 978 }, { le: 1, count: 995 }, { le: Infinity, count: 1000 }];
export function quantile(q: number) {
  const total = BUCKETS[BUCKETS.length - 1].count, target = q * total;
  let prevLe = 0, prevC = 0;
  for (const b of BUCKETS) {
    if (b.count >= target) { const le = b.le === Infinity ? prevLe : b.le; return prevLe + ((target - prevC) / (b.count - prevC)) * (le - prevLe); }
    prevLe = b.le; prevC = b.count;
  }
  return prevLe;
}
