// An LSM tree: writes go to memory, get flushed as sorted files, and compaction merges them.
export type Kv = [string, string];
export type Frame = { op: string; mem: Kv[]; l0: Kv[][]; l1: Kv[]; text: string; probe?: string[]; found?: string };
const CAP = 3;
const OPS: [string, string, string?][] = [["put", "m", "1"], ["put", "c", "1"], ["put", "x", "1"], ["put", "c", "2"], ["put", "a", "1"], ["put", "q", "1"], ["get", "c"], ["put", "m", "2"], ["put", "z", "1"], ["put", "b", "1"], ["compact", ""], ["get", "c"], ["get", "k"]];

export function frames(): Frame[] {
  let mem: Kv[] = [], l0: Kv[][] = [], l1: Kv[] = [];
  const out: Frame[] = [{ op: "", mem: [], l0: [], l1: [], text: "Empty. Writes go to an in-memory table (the memtable), kept sorted." }];
  const snap = (op: string, text: string, extra: Partial<Frame> = {}) => out.push({ op, mem: [...mem], l0: l0.map((s) => [...s]), l1: [...l1], text, ...extra });
  const sort = (xs: Kv[]) => [...xs].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [op, k, v] of OPS) {
    if (op === "put") {
      mem = sort([...mem.filter((x) => x[0] !== k), [k, v!]]);
      snap(`put ${k}=${v}`, `Write ${k}=${v} into the memtable (and the write-ahead log). No disk seek: just an append.`);
      if (mem.length >= CAP) { l0 = [mem, ...l0]; mem = []; snap("flush", "Memtable full: write it to disk as an immutable sorted file (SSTable). Old values aren't overwritten; newer files shadow them."); }
    } else if (op === "get") {
      const probe: string[] = ["memtable"];
      let found = mem.find((x) => x[0] === k)?.[1];
      for (let i = 0; !found && i < l0.length; i++) { probe.push(`L0 file ${i + 1}`); found = l0[i].find((x) => x[0] === k)?.[1]; }
      if (!found) { probe.push("L1"); found = l1.find((x) => x[0] === k)?.[1]; }
      snap(`get ${k}`, found ? `Read ${k}: check newest first. Found ${k}=${found} after ${probe.length} places.` : `Read ${k}: checked ${probe.length} places and it's not there. Bloom filters let real systems skip most files.`, { probe, found: found ?? "not found" });
    } else {
      const merged = new Map<string, string>();
      for (const [kk, vv] of l1) merged.set(kk, vv);
      for (const f of [...l0].reverse()) for (const [kk, vv] of f) merged.set(kk, vv);
      l1 = sort([...merged.entries()]); l0 = [];
      snap("compact", "Compaction merges the L0 files into one sorted L1 file, keeping only the newest value of each key. Fewer files to check on reads.");
    }
  }
  return out;
}
