// Saving a config file so a crash can't corrupt it. A file's bytes and its name are stored
// separately: data blocks are written back when the page cache flushes them (after ~30 s), while
// metadata (sizes, truncation, directory entries) goes through the file system's journal,
// committed every 5 s (ext4's default). With delayed allocation the two drift apart, which is
// how the famous zero-length files after a crash happened. fsync(fd) forces a file's data and
// metadata to disk and flushes the drive's cache; fsync on the directory makes a rename stick.
// Each pattern runs at t = 1 s; pick a crash time and see what's on disk after reboot.
// POSIX only promises what was fsynced; the 5 s / 30 s timings follow ext4's defaults.

export const COMMIT_S = 5;
export const WRITEBACK_S = 30;
export const START = 1;

export type Pattern = "inPlace" | "fsyncFile" | "renameOnly" | "safe";
export const PATTERNS: Pattern[] = ["inPlace", "fsyncFile", "renameOnly", "safe"];
export const PATTERN: Record<Pattern, { label: string; code: string[] }> = {
  inPlace: { label: "Overwrite in place", code: ['fd = open("config", O_TRUNC)', "write(fd, new)", "close(fd)"] },
  fsyncFile: { label: "Overwrite + fsync", code: ['fd = open("config", O_TRUNC)', "write(fd, new)", "fsync(fd)", "close(fd)"] },
  renameOnly: { label: "Temp file + rename", code: ['fd = open("config.tmp")', "write(fd, new)", "close(fd)", 'rename("config.tmp", "config")'] },
  safe: { label: "Temp + fsync + rename + fsync dir", code: ['fd = open("config.tmp")', "write(fd, new)", "fsync(fd)", "close(fd)", 'rename("config.tmp", "config")', "fsync(dirfd)"] },
};

export type Outcome = "old" | "new" | "empty" | "partial";
export const OUTCOME_LABEL: Record<Outcome, string> = { old: "old contents", new: "new contents", empty: "empty file (0 bytes)", partial: "partly written" };

// What "config" holds after a crash at time `crash` (seconds), with an fsync taking `fsyncMs`.
export function afterCrash(p: Pattern, crash: number, fsyncMs = 5): { outcome: Outcome; why: string } {
  const f = fsyncMs / 1000;
  const firstCommit = Math.ceil((START + 1e-9) / COMMIT_S) * COMMIT_S; // next journal commit after the ops
  const dataOnDisk = START + WRITEBACK_S;
  if (crash < START) return { outcome: "old", why: "nothing has happened yet" };
  if (p === "inPlace") {
    if (crash < firstCommit) return { outcome: "old", why: "the truncate and the new size are still only in memory" };
    if (crash < dataOnDisk) return { outcome: "empty", why: `the journal committed the truncate at ${firstCommit} s, but the new bytes were never written: they'd go out at ~${dataOnDisk} s` };
    return { outcome: "new", why: "both the metadata and the data reached the disk eventually, by luck of timing" };
  }
  if (p === "fsyncFile") {
    if (crash < START + f) return { outcome: "partial", why: "crashed in the middle of the fsync: the old bytes were already truncated away and only some new blocks reached the disk. Overwriting in place is never atomic, even with fsync" };
    return { outcome: "new", why: `fsync returned after ${fsyncMs} ms: data, size and the drive's cache are all on disk` };
  }
  if (p === "renameOnly") {
    if (crash < firstCommit) return { outcome: "old", why: "the rename is still only in memory, so config is the old file" };
    if (crash < dataOnDisk) return { outcome: "empty", why: `the journal committed the rename at ${firstCommit} s, so config now names the temp file's inode, whose data was never written` };
    return { outcome: "new", why: "the data caught up with the rename at writeback" };
  }
  // safe: data is durable before the rename; the rename is durable after fsync(dir)
  if (crash < START + f) return { outcome: "old", why: "crashed while fsyncing the temp file: config is untouched" };
  if (crash < START + 2 * f) return { outcome: firstCommit <= crash ? "new" : "old", why: "the rename may or may not have been committed, but either name points to a complete file" };
  return { outcome: "new", why: "fsync(dir) made the rename durable; the temp file's data was already on disk" };
}

// Crash times worth showing for each pattern
export const CRASH_MARKS = [0.5, 1.003, 3, 5.5, 20, 32];

// fsync costs: the drive has to confirm the data is on stable media
export type Device = "hdd" | "sata" | "nvmeConsumer" | "nvmePlp";
export const DEVICES: Record<Device, { label: string; ms: number; note: string }> = {
  hdd: { label: "Hard disk", ms: 8, note: "wait for the platter to come round" },
  sata: { label: "SATA SSD", ms: 2, note: "flush its volatile write cache" },
  nvmeConsumer: { label: "Consumer NVMe", ms: 0.8, note: "flush its cache" },
  nvmePlp: { label: "NVMe with power-loss protection", ms: 0.03, note: "capacitors keep its cache safe, so a flush is nearly free" },
};

// Commits per second if each waits for its own fsync, and with group commit (one fsync covers
// every transaction waiting at the time, the way databases batch WAL flushes)
export function commitsPerSec(d: Device, writers: number) {
  const each = 1000 / DEVICES[d].ms;
  return { alone: each, grouped: each * writers, latencyMs: DEVICES[d].ms * (writers > 1 ? 1.5 : 1) };
}
