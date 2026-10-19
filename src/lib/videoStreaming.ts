// Design video streaming: transcode an upload into a bitrate ladder, cut it into
// segments, deliver them through a CDN, and let the player pick a rendition for each
// segment from what the network is doing. The playback is simulated in 50 ms steps.

export const LADDER = [
  { id: "240p", mbps: 0.4 },
  { id: "360p", mbps: 0.8 },
  { id: "480p", mbps: 1.4 },
  { id: "720p", mbps: 2.8 },
  { id: "1080p", mbps: 5.0 },
];
export const VIDEO_S = 600; // a 10-minute upload
export const SEGMENT_S = 4;

export const storageMB = () => (LADDER.reduce((s, r) => s + r.mbps, 0) * VIDEO_S) / 8;
export const UPLOADS_PER_DAY = 500_000;

// Transcoding: one worker encodes one rendition of one segment at real time.
export const WORKERS = [1, 10, 100, 1000];
export function transcodeS(workers: number, parallel: boolean) {
  if (!parallel) return VIDEO_S * LADDER.length; // one machine, whole file, each rendition in turn
  const jobs = (VIDEO_S / SEGMENT_S) * LADDER.length;
  return Math.ceil(jobs / workers) * SEGMENT_S;
}

// The network a viewer on a train sees, in Mbps.
export const PLAY_S = 120;
export function bandwidth(t: number) {
  if (t < 30) return 8;
  if (t < 70) return 1.5;
  if (t < 80) return 0.5; // a tunnel
  return 6;
}

export type Abr = "fixed1080" | "fixed360" | "throughput" | "buffer";
export const ABRS: { id: Abr; label: string; one: string }[] = [
  { id: "fixed1080", label: "Always 1080p", one: "One rendition, the best one, whatever the network does." },
  { id: "fixed360", label: "Always 360p", one: "One rendition, small enough to survive almost anything." },
  { id: "throughput", label: "By throughput", one: "Pick the highest rendition below 80% of the speed the last segment downloaded at." },
  { id: "buffer", label: "By buffer", one: "Pick from how many seconds are buffered: lowest below 8 s, highest above 24 s, in between in steps." },
];
export const MAX_BUFFER = 30;

export type Seg = { i: number; rendition: number; requestedAt: number; doneAt: number; mbps: number };
export type Play = { segments: Seg[]; startup: number; stallS: number; stalls: number; avgMbps: number; switches: number; bufferTrace: [number, number][]; end: number };

export function play(abr: Abr): Play {
  const DT = 0.05;
  const total = PLAY_S / SEGMENT_S;
  let t = 0;
  let buffer = 0;
  let playing = false;
  let startup = 0;
  let stallS = 0;
  let stalls = 0;
  let stalled = false;
  let lastMbps = 3; // a guess before anything has downloaded
  const segs: Seg[] = [];
  const bufferTrace: [number, number][] = [];
  let played = 0;

  const pick = () => {
    if (abr === "fixed1080") return 4;
    if (abr === "fixed360") return 1;
    if (abr === "throughput") {
      let r = 0;
      LADDER.forEach((x, i) => {
        if (x.mbps <= lastMbps * 0.8) r = i;
      });
      return r;
    }
    if (buffer < 8) return 0;
    if (buffer > 24) return 4;
    return Math.min(4, 1 + Math.floor((buffer - 8) / 6));
  };

  // advance time while playing back from the buffer
  const tick = () => {
    if (playing) {
      if (buffer > 0) {
        const step = Math.min(DT, buffer);
        buffer -= step;
        played += step;
        if (stalled) stalled = false;
      } else if (played < PLAY_S - 1e-6) {
        if (!stalled) {
          stalls++;
          stalled = true;
        }
        stallS += DT;
      }
    }
    t += DT;
    if (Math.round(t / DT) % 10 === 0) bufferTrace.push([t, buffer]);
  };

  for (let i = 0; i < total; i++) {
    // don't fetch more while the buffer is full
    while (buffer + SEGMENT_S > MAX_BUFFER) tick();
    const r = pick();
    const bits = LADDER[r].mbps * SEGMENT_S;
    const start = t;
    let got = 0;
    while (got < bits) {
      got += bandwidth(t) * DT;
      tick();
    }
    const took = t - start;
    lastMbps = bits / took;
    buffer += SEGMENT_S;
    segs.push({ i, rendition: r, requestedAt: start, doneAt: t, mbps: LADDER[r].mbps });
    if (!playing && buffer >= SEGMENT_S) {
      playing = true;
      startup = t;
    }
  }
  while (played < PLAY_S - 1e-6) tick();

  let switches = 0;
  for (let i = 1; i < segs.length; i++) if (segs[i].rendition !== segs[i - 1].rendition) switches++;
  const avgMbps = segs.reduce((s, x) => s + x.mbps, 0) / segs.length;
  return { segments: segs, startup, stallS: Math.round(stallS * 10) / 10, stalls, avgMbps, switches, bufferTrace, end: t };
}

// The HLS master playlist the player reads first.
export const manifest = () =>
  ["#EXTM3U", ...LADDER.flatMap((r) => [`#EXT-X-STREAM-INF:BANDWIDTH=${Math.round(r.mbps * 1e6)},RESOLUTION=${{ "240p": "426x240", "360p": "640x360", "480p": "854x480", "720p": "1280x720", "1080p": "1920x1080" }[r.id]}`, `${r.id}/index.m3u8`])].join("\n");

// Delivery: viewing hours a day and how much the CDN absorbs.
export const WATCH_HOURS = 100e6;
export const CDN_HIT = [0.8, 0.95, 0.99];
export function egress(avgMbps: number, hit: number) {
  const pb = (WATCH_HOURS * 3600 * avgMbps) / 8 / 1e9; // PB a day
  return { totalPB: pb, originPB: pb * (1 - hit) };
}
