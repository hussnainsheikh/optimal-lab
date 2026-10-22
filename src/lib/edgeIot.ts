// A temperature sensor in a refrigerated delivery truck reads once a minute for a
// day: 1,440 readings. The truck drives through dead zones, the device reboots once,
// and at 10:40 the fridge door is left open for a quarter of an hour. What reaches
// the cloud depends on what the device does while it's offline.
//
// Times are minutes after midnight.

export const MINUTES = 24 * 60;
export const OFFLINE: [number, number][] = [
  [2 * 60, 2 * 60 + 20],
  [9 * 60, 13 * 60], // rural route, no signal
  [18 * 60, 18 * 60 + 45],
];
export const REBOOT = 11 * 60 + 30; // watchdog restarts the device
export const EXCURSION: [number, number] = [10 * 60 + 40, 10 * 60 + 55]; // door open, above 8 °C
export const BUFFER = 200; // readings the device can hold
export const SUMMARY_EVERY = 5; // minutes per summary record when aggregating

export const online = (m: number) => !OFFLINE.some(([a, b]) => m >= a && m < b);
export const tempAt = (m: number) => (m >= EXCURSION[0] && m < EXCURSION[1] ? 9.5 + ((m - EXCURSION[0]) % 5) * 0.3 : 3.5 + Math.sin(m / 40) * 0.6);

export type Mode = "none" | "ram" | "flash" | "summary";
export const MODES: { id: Mode; label: string; one: string }[] = [
  { id: "none", label: "Send or drop", one: "Publish each reading if there's a connection; otherwise it's gone." },
  { id: "ram", label: "Buffer in memory", one: `Queue up to ${BUFFER} readings in RAM and send them on reconnect. A reboot empties the queue.` },
  { id: "flash", label: "Buffer on flash", one: `Queue up to ${BUFFER} readings on flash, which survives a reboot. When full, drop the oldest.` },
  { id: "summary", label: "Flash + summaries", one: `While offline, store one ${SUMMARY_EVERY}-minute summary (min, max, average) instead of five raw readings.` },
];

export type Fate = "live" | "late" | "summarised" | "lost";
export type DayResult = {
  fate: Fate[]; // per minute
  live: number;
  late: number;
  summarised: number;
  lost: number;
  lostToReboot: number;
  lostToOverflow: number;
  excursionSeen: boolean; // did the cloud ever learn about the open door?
  excursionKnownAt: number | null; // minute the cloud learned of it
  messages: number; // MQTT messages published
  bytes: number;
};

export const READING_B = 48; // payload: device id, time, temperature, battery
export const SUMMARY_B = 64;
export const MSG_OVERHEAD_B = 40; // MQTT + TLS record framing per message
export const BATCH = 50; // records per message when uploading a backlog

export function day(mode: Mode): DayResult {
  const fate: Fate[] = Array(MINUTES).fill("lost");
  // the queue holds records: a raw minute, or a summary covering several minutes
  let queue: { minutes: number[]; summary: boolean }[] = [];
  let lostToReboot = 0;
  let lostToOverflow = 0;
  let messages = 0;
  let bytes = 0;
  let excursionKnownAt: number | null = null;
  const touchesExcursion = (ms: number[]) => ms.some((m) => m >= EXCURSION[0] && m < EXCURSION[1]);

  const flush = (now: number) => {
    if (!queue.length) return;
    for (let i = 0; i < queue.length; i += BATCH) {
      const chunk = queue.slice(i, i + BATCH);
      messages++;
      bytes += MSG_OVERHEAD_B + chunk.reduce((s, r) => s + (r.summary ? SUMMARY_B : READING_B), 0);
    }
    for (const r of queue) {
      for (const m of r.minutes) fate[m] = r.summary ? "summarised" : "late";
      if (excursionKnownAt === null && touchesExcursion(r.minutes)) excursionKnownAt = now;
    }
    queue = [];
  };

  for (let m = 0; m < MINUTES; m++) {
    if (m === REBOOT && mode === "ram") {
      lostToReboot += queue.reduce((s, r) => s + r.minutes.length, 0);
      queue = [];
    }
    if (online(m)) {
      flush(m);
      fate[m] = "live";
      messages++;
      bytes += MSG_OVERHEAD_B + READING_B;
      if (excursionKnownAt === null && touchesExcursion([m])) excursionKnownAt = m;
      continue;
    }
    if (mode === "none") continue;
    if (mode === "summary") {
      const last = queue[queue.length - 1];
      if (last && last.summary && last.minutes.length < SUMMARY_EVERY && Math.floor(last.minutes[0] / SUMMARY_EVERY) === Math.floor(m / SUMMARY_EVERY)) last.minutes.push(m);
      else queue.push({ minutes: [m], summary: true });
    } else {
      queue.push({ minutes: [m], summary: false });
    }
    if (queue.length > BUFFER) {
      const dropped = queue.shift()!;
      lostToOverflow += dropped.minutes.length;
    }
  }
  flush(MINUTES);

  const count = (f: Fate) => fate.filter((x) => x === f).length;
  return {
    fate,
    live: count("live"),
    late: count("late"),
    summarised: count("summarised"),
    lost: count("lost"),
    lostToReboot,
    lostToOverflow,
    excursionSeen: excursionKnownAt !== null,
    excursionKnownAt,
    messages,
    bytes,
  };
}

export const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

// A cell tower comes back after an outage and every truck in range reconnects at once.
export const FLEET_IN_RANGE = 2000;
export const BACKLOG = BUFFER;
export const JITTER_S = [0, 60, 600];
export function reconnectPeak(jitterS: number) {
  const total = FLEET_IN_RANGE * Math.ceil(BACKLOG / BATCH); // messages
  // without jitter they all arrive within about 2 seconds of the tower coming back
  const window = Math.max(2, jitterS);
  return { total, perSec: Math.round(total / window), connectsPerSec: Math.round(FLEET_IN_RANGE / window) };
}

// Over-the-air update for 5,000 trucks. The new build boot-loops on hardware rev B
// (20% of the fleet), and 0.5% of devices lose power while writing the image.
export const FLEET = 5000;
export const REV_B = 0.2;
export const POWER_LOSS = 0.005;
export type Update = "inplace" | "ab" | "staged";
export const UPDATES: { id: Update; label: string; one: string }[] = [
  { id: "inplace", label: "In place, everyone", one: "Overwrite the running firmware on every truck at once." },
  { id: "ab", label: "A/B slots, everyone", one: "Write the new image to the spare slot, boot it, and fall back to the old slot if it doesn't report healthy." },
  { id: "staged", label: "A/B slots, staged", one: "Same, to 1% of trucks first. If any fall back, stop the rollout." },
];
export function rollout(u: Update) {
  const reached = u === "staged" ? Math.round(FLEET * 0.01) : FLEET;
  const hitBad = Math.round(reached * REV_B);
  const powerFail = Math.round(reached * POWER_LOSS);
  // in place: a bad build or a half-written image leaves no working firmware
  const bricked = u === "inplace" ? hitBad + powerFail : 0;
  const rolledBack = u === "inplace" ? 0 : hitBad + powerFail;
  return { reached, hitBad, bricked, rolledBack };
}
