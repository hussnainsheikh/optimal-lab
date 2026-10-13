// Sort by start, then sweep and merge overlaps.
export type Iv = [number, number];
export const INPUT: Iv[] = [[8, 10], [1, 3], [15, 18], [2, 6], [9, 12], [17, 19], [4, 5]];
export type Frame = { sorted: Iv[]; i: number; merged: Iv[]; text: string };

export function run(): Frame[] {
  const s = [...INPUT].sort((a, b) => a[0] - b[0]);
  const m: Iv[] = [];
  const out: Frame[] = [{ sorted: s, i: -1, merged: [], text: "Sort by start time. Now any overlap is with the interval just before." }];
  s.forEach((iv, i) => {
    const last = m[m.length - 1];
    if (last && iv[0] <= last[1]) {
      const grew = iv[1] > last[1];
      last[1] = Math.max(last[1], iv[1]);
      out.push({ sorted: s, i, merged: m.map((x) => [...x] as Iv), text: `[${iv}] starts at ${iv[0]}, before the last one ends. Merge${grew ? `: extend the end to ${last[1]}` : ": it's inside, nothing changes"}.` });
    } else {
      m.push([...iv]);
      out.push({ sorted: s, i, merged: m.map((x) => [...x] as Iv), text: last ? `[${iv}] starts after ${last[1]}: a gap. Start a new interval.` : `Take the first interval [${iv}].` });
    }
  });
  out.push({ sorted: s, i: s.length, merged: m.map((x) => [...x] as Iv), text: `${INPUT.length} intervals became ${m.length}. Sorting is O(n log n); the sweep is one pass.` });
  return out;
}
