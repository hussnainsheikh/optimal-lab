// Demand paging: a program loops over W pages, `rounds` times, with only R frames of RAM.
// First touch of a page is a minor fault (the kernel hands over a zeroed frame, no disk).
// When RAM is full the least recently used page goes to swap; touching it again is a
// major fault (a disk read). Costs are round, typical numbers, not measurements.

export type Kind = "hit" | "minor" | "major";
export type Disk = "ssd" | "hdd";
export const DISKS: { id: Disk; label: string }[] = [
  { id: "ssd", label: "Swap on SSD (~100 µs)" },
  { id: "hdd", label: "Swap on hard disk (~10 ms)" },
];
export const COST_US = { hit: 0.1, minor: 1, major: { ssd: 100, hdd: 10_000 } as Record<Disk, number> };
export const ROUNDS = 3;

export type Access = {
  i: number;
  page: number;
  kind: Kind;
  slot: number; // frame the page ends up in
  evicted: number | null; // page pushed out to swap to make room
  ram: (number | null)[]; // frame → page
  swap: number[];
  counts: Record<Kind, number>;
  timeUs: number; // total so far
};

export function cost(kind: Kind, disk: Disk) {
  return kind === "major" ? COST_US.major[disk] : COST_US[kind];
}

export function simulate(frames: number, working: number, disk: Disk, rounds = ROUNDS): Access[] {
  const ram: (number | null)[] = Array<number | null>(frames).fill(null);
  const lastUse = new Map<number, number>();
  const swap = new Set<number>();
  const counts: Record<Kind, number> = { hit: 0, minor: 0, major: 0 };
  const out: Access[] = [];
  let time = 0;
  let i = 0;
  for (let r = 0; r < rounds; r++) {
    for (let page = 0; page < working; page++, i++) {
      let kind: Kind;
      let evicted: number | null = null;
      let slot = ram.indexOf(page);
      if (slot >= 0) kind = "hit";
      else {
        kind = swap.has(page) ? "major" : "minor";
        swap.delete(page);
        slot = ram.indexOf(null);
        if (slot < 0) {
          // evict the least recently used page
          slot = 0;
          for (let f = 1; f < frames; f++) if ((lastUse.get(ram[f]!) ?? -1) < (lastUse.get(ram[slot]!) ?? -1)) slot = f;
          evicted = ram[slot];
          swap.add(evicted!);
        }
        ram[slot] = page;
      }
      lastUse.set(page, i);
      counts[kind]++;
      time += cost(kind, disk);
      out.push({ i, page, kind, slot, evicted, ram: [...ram], swap: [...swap].sort((a, b) => a - b), counts: { ...counts }, timeUs: time });
    }
  }
  return out;
}

export const RAM_MIN = 2;
export const RAM_MAX = 10;

/** Total time for every RAM size: the thrashing cliff. */
export function curve(working: number, disk: Disk) {
  return Array.from({ length: RAM_MAX - RAM_MIN + 1 }, (_, k) => {
    const frames = k + RAM_MIN;
    const run = simulate(frames, working, disk);
    const last = run[run.length - 1];
    return { frames, timeUs: last.timeUs, majors: last.counts.major };
  });
}

export function fmtUs(us: number) {
  if (us >= 1_000_000) return `${(us / 1_000_000).toFixed(2)} s`;
  if (us >= 1000) return `${(us / 1000).toFixed(1)} ms`;
  return `${us.toFixed(1)} µs`;
}
