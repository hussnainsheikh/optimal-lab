// A 3-slot ring buffer shared by a fast producer and a slower consumer.
export type Mode = "unsafe" | "semaphores";
export const SIZE = 3;
// who tries to act on each tick
const SCHEDULE = ["P", "P", "P", "P", "P", "C", "P", "C", "C", "C", "C", "C"];
export type Frame = { who: string; slots: (string | null)[]; count: number; text: string; problem?: boolean; blocked?: boolean; empty: number; full: number };

export function run(mode: Mode): Frame[] {
  const slots: (string | null)[] = Array(SIZE).fill(null);
  let inI = 0, outI = 0, count = 0, n = 1, empty = SIZE, full = 0;
  const out: Frame[] = [{ who: "", slots: [...slots], count, text: `Empty buffer with ${SIZE} slots. Semaphores: empty = ${SIZE}, full = 0.`, empty, full }];
  for (const who of SCHEDULE) {
    if (who === "P") {
      const item = `#${n}`;
      if (mode === "semaphores" && empty === 0) { out.push({ who, slots: [...slots], count, text: `Producer wants to add ${item}, but wait(empty) finds 0 free slots. It sleeps instead of spinning.`, blocked: true, empty, full }); continue; }
      const overwrote = slots[inI];
      slots[inI] = item; inI = (inI + 1) % SIZE; n++;
      if (mode === "semaphores") { empty--; full++; }
      count = Math.min(SIZE, count + 1);
      out.push({ who, slots: [...slots], count, empty, full, problem: !!overwrote && mode === "unsafe", text: overwrote && mode === "unsafe" ? `Producer writes ${item} over ${overwrote}, which nobody consumed. Data lost.` : `Producer adds ${item}.${mode === "semaphores" ? " wait(empty), lock, insert, unlock, signal(full)." : ""}` });
    } else {
      const item = slots[outI];
      if (!item) { out.push({ who, slots: [...slots], count, empty, full, problem: mode === "unsafe", blocked: mode === "semaphores", text: mode === "unsafe" ? "Consumer reads an empty slot: garbage." : "Consumer waits on full = 0." }); continue; }
      slots[outI] = null; outI = (outI + 1) % SIZE; count--;
      if (mode === "semaphores") { full--; empty++; }
      out.push({ who, slots: [...slots], count, empty, full, text: `Consumer takes ${item}.${mode === "semaphores" ? " signal(empty) wakes a waiting producer." : ""}` });
    }
  }
  return out;
}
