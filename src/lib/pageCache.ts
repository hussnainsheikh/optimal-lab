// What happens to a big write on Linux. write() copies bytes into the page cache in RAM and
// returns; those pages are "dirty" until the kernel's flusher threads write them to disk.
// Writeback starts in the background once dirty data passes dirty_background_ratio (10% of
// available memory), or once it's older than dirty_expire_centisecs (30 s, checked every 5 s).
// If dirty data reaches dirty_ratio (20%), the writing process itself is throttled to disk
// speed. Simulated every 10 ms with Linux's default ratios; memory and disk speeds are
// illustrative. A power cut loses whatever is still dirty.

export const AVAILABLE_GB = 12; // memory the page cache can use (a 16 GB machine)
export const BG_RATIO = 0.1;
export const DIRTY_RATIO = 0.2;
export const EXPIRE_S = 30;
export const WAKE_S = 5;
export const MEMCPY_GBS = 4; // how fast write() copies into the cache

export type Disk = "hdd" | "ssd" | "nvme";
export const DISKS: Record<Disk, { label: string; mbs: number; readMbs: number }> = {
  hdd: { label: "Hard disk", mbs: 150, readMbs: 160 },
  ssd: { label: "SATA SSD", mbs: 450, readMbs: 520 },
  nvme: { label: "NVMe SSD", mbs: 2500, readMbs: 3200 },
};

export type Point = { t: number; dirty: number; onDisk: number; written: number; throttled: boolean };
export type Result = {
  series: Point[]; // every 100 ms, in GB
  writeReturns: number; // seconds until the app's last write() returns
  durableAt: number; // seconds until every byte is on disk
  throttledFor: number; // seconds the app was held to disk speed
  appGBs: number; // what the app saw: size / time for write() calls
  bg: number; limit: number; // thresholds in GB
  fsyncAt: number | null; // with fsync at the end: when it returns
};

export function simulate(sizeGB: number, disk: Disk, fsync: boolean): Result {
  const dt = 0.01;
  const diskGBs = DISKS[disk].mbs / 1024;
  const bg = AVAILABLE_GB * BG_RATIO, limit = AVAILABLE_GB * DIRTY_RATIO;
  let t = 0, written = 0, onDisk = 0, throttledFor = 0;
  let writeReturns = -1, durableAt = -1, fsyncAt: number | null = null;
  let lastWake = 0;
  let flushing = false;
  const firstDirtyAt: number[] = []; // when each chunk became dirty (FIFO, 0.01 GB chunks)
  const series: Point[] = [];
  for (let step = 0; t < 600; step++) {
    const dirty = written - onDisk;
    // the app writes until done; past dirty_ratio it is held to the speed of writeback
    let throttled = false;
    if (written < sizeGB) {
      let rate = MEMCPY_GBS;
      if (dirty >= limit) { rate = Math.min(rate, diskGBs); throttled = true; throttledFor += dt; }
      const add = Math.min(rate * dt, sizeGB - written);
      written += add;
      for (let c = 0; c < Math.round(add / 0.01); c++) firstDirtyAt.push(t);
      if (written >= sizeGB - 1e-9) writeReturns = t + dt;
    }
    // the flusher: background writeback over the threshold, or for data older than 30 s
    if (t - lastWake >= WAKE_S) { lastWake = t; if (firstDirtyAt.length && t - firstDirtyAt[0] >= EXPIRE_S) flushing = true; }
    const dirtyNow = written - onDisk;
    if (dirtyNow > bg || throttled) flushing = true;
    if (fsync && writeReturns >= 0) flushing = true; // fsync forces everything out now
    if (flushing && dirtyNow > 0) {
      const out = Math.min(diskGBs * dt, dirtyNow);
      onDisk += out;
      firstDirtyAt.splice(0, Math.round(out / 0.01));
      if (dirtyNow - out <= bg && !(fsync && writeReturns >= 0) && !(firstDirtyAt.length && t - firstDirtyAt[0] >= EXPIRE_S)) flushing = false;
    }
    if (step % 10 === 0) series.push({ t, dirty: written - onDisk, onDisk, written, throttled });
    t += dt;
    if (written >= sizeGB - 1e-9 && written - onDisk <= 1e-6) {
      durableAt = t;
      if (fsync) fsyncAt = t;
      series.push({ t, dirty: 0, onDisk, written, throttled: false });
      break;
    }
  }
  return { series, writeReturns, durableAt, throttledFor, appGBs: sizeGB / Math.max(writeReturns, 0.01), bg, limit, fsyncAt };
}

// GB still only in RAM at time `at` (seconds): what a power cut would lose
export function lostAt(r: Result, at: number) {
  let p = r.series[0];
  for (const s of r.series) if (s.t <= at) p = s;
  return p.dirty;
}

// Reading the file back: from disk the first time, from RAM after that if it fits
export function readBack(sizeGB: number, disk: Disk) {
  const cold = (sizeGB * 1024) / DISKS[disk].readMbs;
  const fits = sizeGB <= AVAILABLE_GB * 0.9;
  const warm = fits ? sizeGB / 10 : cold; // ~10 GB/s from RAM
  return { cold, warm, fits };
}
