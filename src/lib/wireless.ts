// Why Wi-Fi and mobile latency jumps around. Signal strength falls with distance and walls
// (log-distance path loss); noise is thermal noise over the channel width (−174 dBm/Hz +
// 10·log10(bandwidth) + a 7 dB receiver noise figure). The access point picks the fastest Wi-Fi 6
// rate (MCS) whose signal-to-noise threshold the link clears. Stations share one channel: with
// equal chances to send, a slow station holds the air longest and drags everyone to its speed;
// airtime fairness gives each station equal time instead. Frames that fail are retried with a
// doubling random backoff, which hides loss but adds delay; 2,000 frames are simulated. On
// mobile, a radio that has gone idle must be promoted back to connected before the first packet
// moves. MCS rates are the Wi-Fi 6 tables; thresholds, wall losses and radio timers are typical
// values.

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Band = "2.4" | "5";
export const BAND: Record<Band, { pl0: number; wall: number; mhz: number; label: string }> = {
  "2.4": { pl0: 40, wall: 4, mhz: 20, label: "2.4 GHz, 20 MHz" },
  "5": { pl0: 47, wall: 7, mhz: 80, label: "5 GHz, 80 MHz" },
};
export const TX_DBM = 20;
const EXPONENT = 3; // indoors
const NOISE_FIGURE = 7;

// Wi-Fi 6, one spatial stream, 0.8 µs guard interval: Mbps for MCS 0–11 at 20 and 80 MHz.
const RATE_20 = [8.6, 17.2, 25.8, 34.4, 51.6, 68.8, 77.4, 86.0, 103.2, 114.7, 129.0, 143.4];
const RATE_80 = [36.0, 72.1, 108.1, 144.1, 216.2, 288.2, 324.3, 360.3, 432.4, 480.4, 540.4, 600.5];
export const MCS_SNR = [2, 5, 9, 11, 15, 18, 20, 25, 29, 31, 34, 37];
export const MODULATION = ["BPSK 1/2", "QPSK 1/2", "QPSK 3/4", "16-QAM 1/2", "16-QAM 3/4", "64-QAM 2/3", "64-QAM 3/4", "64-QAM 5/6", "256-QAM 3/4", "256-QAM 5/6", "1024-QAM 3/4", "1024-QAM 5/6"];
export const STREAMS = 2;
export const MAC_EFFICIENCY = 0.65;

export const rateTable = (b: Band) => (BAND[b].mhz === 80 ? RATE_80 : RATE_20).map((r) => r * STREAMS);

export function link(b: Band, meters: number, walls: number) {
  const band = BAND[b];
  const loss = band.pl0 + 10 * EXPONENT * Math.log10(Math.max(1, meters)) + walls * band.wall;
  const rssi = TX_DBM - loss;
  const noise = -174 + 10 * Math.log10(band.mhz * 1e6) + NOISE_FIGURE;
  const snr = rssi - noise;
  let mcs = -1;
  for (let i = 0; i < MCS_SNR.length; i++) if (snr >= MCS_SNR[i] + 2) mcs = i; // 2 dB margin
  const phy = mcs >= 0 ? rateTable(b)[mcs] : 0;
  return { loss, rssi, noise, snr, mcs, phy, goodput: phy * MAC_EFFICIENCY, margin: mcs >= 0 ? snr - MCS_SNR[mcs] : snr - MCS_SNR[0] };
}

export type Station = { name: string; phy: number };

// Saturated stations with equal chances to send equal frames all end up with the same throughput:
// 1 / Σ(1/rate). With airtime fairness each gets 1/n of the time at its own rate.
export function share(stations: Station[], airtimeFair: boolean): number[] {
  const rates = stations.map((s) => s.phy * MAC_EFFICIENCY);
  if (airtimeFair) return rates.map((r) => r / rates.length);
  const each = 1 / rates.reduce((s, r) => s + 1 / r, 0);
  return rates.map(() => each);
}

// Frame error rate from the margin above the chosen rate's threshold (a logistic curve).
export function frameErrorRate(margin: number, interference: boolean): number {
  const base = 1 / (1 + Math.exp(1.6 * (margin - 1)));
  return Math.min(0.95, interference ? base + (1 - base) * 0.3 : base);
}

const SLOT_US = 9;
const CW_MIN = 15;
const CW_MAX = 1023;
export const RETRY_LIMIT = 7;

export function retries(phyMbps: number, margin: number, interference: boolean, frames = 2000) {
  const r = rng(31);
  const fer = frameErrorRate(margin, interference);
  const air = phyMbps > 0 ? (1500 * 8) / phyMbps + 60 : 0; // µs on air incl. preamble and ACK
  const lat: number[] = [];
  let dropped = 0;
  let attempts = 0;
  for (let f = 0; f < frames; f++) {
    let t = 0;
    let cw = CW_MIN;
    let ok = false;
    for (let a = 0; a <= RETRY_LIMIT; a++) {
      attempts++;
      t += 34 + Math.floor(r() * (cw + 1)) * SLOT_US + air; // DIFS, random backoff, the frame
      if (r() >= fer) {
        ok = true;
        break;
      }
      cw = Math.min(CW_MAX, cw * 2 + 1);
    }
    if (ok) lat.push(t / 1000);
    else dropped++;
  }
  lat.sort((a, b) => a - b);
  const q = (p: number) => lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] ?? 0;
  return { fer, p50: q(0.5), p99: q(0.99), dropped, attempts: attempts / frames };
}

// ── Mobile radio states ──────────────────────────────────────────────────────

export type Cell = "lte" | "nr";
export const CELL: Record<Cell, { label: string; rtt: number; schedule: number; promotion: number; tail: number }> = {
  lte: { label: "4G LTE", rtt: 45, schedule: 10, promotion: 110, tail: 10 },
  nr: { label: "5G (standalone)", rtt: 22, schedule: 4, promotion: 35, tail: 10 },
};

// An app sends a small request every `gap` seconds. If the radio dropped to idle since the last
// one, the request waits for the promotion first. The radio stays on for the tail timer after.
export function mobile(c: Cell, gap: number) {
  const k = CELL[c];
  const idle = gap > k.tail;
  const latency = k.rtt + k.schedule + (idle ? k.promotion : 0);
  const radioOn = Math.min(1, (Math.min(gap, k.tail) + latency / 1000) / gap);
  return { idle, latency, radioOn };
}
