// A mobile app sends "order placed" events to analytics. Each event carries the time it
// happened on the phone (event time); it reaches the pipeline later (arrival time),
// sometimes much later when the phone was offline. Some are delivered twice.
// Six hours of events, 10:00 to 16:00, counted per hour four ways.
//
// Times are minutes after 10:00.

export const START_HOUR = 10;
export const HOURS = 6;
export const NIGHTLY_AT = (24 - START_HOUR) * 60; // the batch job runs at midnight

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Ev = { id: number; t: number; arrival: number; dup: boolean };

// Delay mix: most events arrive within a minute, some within twenty, a few within two
// hours, and one in a hundred when the phone comes back online the next day.
export const DELAYS = [
  { share: 0.85, label: "under 1 min", min: 0, max: 1 },
  { share: 0.1, label: "2 to 20 min", min: 2, max: 20 },
  { share: 0.04, label: "30 min to 2 h", min: 30, max: 120 },
  { share: 0.01, label: "next day", min: 900, max: 1300 },
];
export const DUP_RATE = 0.03;

export const EVENTS: Ev[] = (() => {
  const r = mulberry32(42);
  const out: Ev[] = [];
  let id = 0;
  for (let h = 0; h < HOURS; h++) {
    const n = [84, 120, 152, 138, 96, 110][h]; // lunch peak
    for (let k = 0; k < n; k++) {
      const t = h * 60 + r() * 60;
      const u = r();
      let acc = 0;
      let band = DELAYS[0];
      for (const d of DELAYS) {
        acc += d.share;
        if (u < acc) {
          band = d;
          break;
        }
      }
      const delay = band.min + r() * (band.max - band.min);
      const e = { id: id++, t, arrival: t + delay, dup: false };
      out.push(e);
      if (r() < DUP_RATE) out.push({ ...e, arrival: e.arrival + 0.5 + r() * 3, dup: true });
    }
  }
  return out;
})();

export const hourOf = (m: number) => Math.floor(m / 60);
export const label = (h: number) => `${START_HOUR + h}:00`;
export const TRUE_COUNTS = Array.from({ length: HOURS }, (_, h) => EVENTS.filter((e) => !e.dup && hourOf(e.t) === h).length);

export type Strategy = "batch" | "processing" | "event";
export const STRATEGIES: { id: Strategy; label: string; one: string }[] = [
  { id: "batch", label: "Nightly batch", one: "Raw events land in object storage; a job at midnight counts the whole day by event time and loads the warehouse." },
  { id: "processing", label: "Stream, arrival time", one: "A stream processor counts each event in the hour it arrives and publishes each hour's count the moment that hour ends." },
  { id: "event", label: "Stream, event time", one: "Count each event in the hour it happened. Wait for a watermark before publishing an hour, and treat later arrivals as late." },
];
export const WATERMARKS = [0, 5, 20, 60];

export type Options = { watermark: number; dedupe: boolean; correct: boolean };

export type Result = {
  first: number[]; // each hour's count when first published
  final: number[]; // after late corrections (if on)
  publishedAt: number[]; // minutes after 10:00 when each hour first appears
  late: number; // events that missed their hour's first result
  misplaced: number; // counted in the wrong hour
  doubles: number; // duplicates counted
  missedForever: number; // never counted, even after corrections
  wrongFirst: number; // events not counted exactly once, in their own hour, when first published
  wrongFinal: number; // the same after corrections
};

export function run(s: Strategy, o: Options): Result {
  const evs = o.dedupe ? EVENTS.filter((e) => !e.dup) : EVENTS;
  const first = Array(HOURS).fill(0);
  const final = Array(HOURS).fill(0);
  const publishedAt = Array.from({ length: HOURS }, (_, h) => (s === "batch" ? NIGHTLY_AT : s === "processing" ? (h + 1) * 60 : (h + 1) * 60 + o.watermark));
  let late = 0;
  let misplaced = 0;
  let missedForever = 0;
  for (const e of evs) {
    const h = hourOf(e.t);
    if (s === "batch") {
      if (e.arrival <= NIGHTLY_AT) {
        first[h]++;
        final[h]++;
      } else {
        late++;
        // tomorrow night's run reprocesses yesterday's partition if corrections are on
        if (o.correct) final[h]++;
        else missedForever++;
      }
    } else if (s === "processing") {
      const ah = hourOf(e.arrival);
      if (ah !== h) misplaced++;
      if (ah < HOURS) {
        first[ah]++;
        final[ah]++;
      } else {
        // arrives after 16:00: lands in an hour this report doesn't show
        missedForever++;
      }
    } else {
      if (e.arrival <= publishedAt[h]) {
        first[h]++;
        final[h]++;
      } else {
        late++;
        if (o.correct) final[h]++;
        else missedForever++;
      }
    }
  }
  const doubles = o.dedupe ? 0 : EVENTS.filter((e) => e.dup).length;
  const wrongFirst = late + misplaced + doubles;
  const wrongFinal = misplaced + doubles + (s === "processing" ? 0 : missedForever);
  return { first, final, publishedAt, late, misplaced, doubles, missedForever, wrongFirst, wrongFinal };
}

export const total = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
// Average wait after an hour ends before its number is visible.
export const freshness = (r: Result) => Math.round(r.publishedAt.reduce((s, p, h) => s + (p - (h + 1) * 60), 0) / HOURS);
export const hm = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`);
