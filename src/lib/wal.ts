// Transfer $50 from A to B, then crash before the data pages are written to disk.
export type Mode = "no-wal" | "wal";
export type Frame = { text: string; memory: Record<string, number>; disk: Record<string, number>; log: string[]; crashed?: boolean; step: string };

export function frames(mode: Mode): Frame[] {
  const disk = { A: 100, B: 0 }, memory = { ...disk };
  const log: string[] = [];
  const out: Frame[] = [];
  const snap = (step: string, text: string, crashed = false) => out.push({ step, text, memory: { ...memory }, disk: { ...disk }, log: [...log], crashed });
  snap("start", "A has 100, B has 0, on disk and in memory.");
  memory.A = 50; memory.B = 50;
  snap("update", "The transaction updates both rows in memory (the buffer pool). Writing pages to disk is slow, so the database delays it.");
  if (mode === "wal") { log.push("T1: A 100→50", "T1: B 0→50", "T1: COMMIT"); snap("log", "Before saying “committed”, append the changes to the write-ahead log and fsync it. One sequential write."); }
  snap("commit", "The client is told COMMIT succeeded.");
  if (mode === "no-wal") { disk.A = 50; snap("partial", "A background flush writes A's page… then power fails before B's page."); }
  memory.A = NaN; memory.B = NaN;
  snap("crash", "Crash. Everything in memory is gone.", true);
  if (mode === "no-wal") { snap("restart", "On restart, disk says A=50, B=0. $50 vanished, and a committed transfer is half-applied.", true); }
  else {
    memory.A = disk.A; memory.B = disk.B;
    snap("restart", "On restart, the data pages still say A=100, B=0. But the log has a committed transaction…", true);
    disk.A = 50; disk.B = 50; memory.A = 50; memory.B = 50;
    snap("redo", "Recovery replays the log: A=50, B=50. The commit survived. (Uncommitted entries would be undone.)");
  }
  return out;
}
