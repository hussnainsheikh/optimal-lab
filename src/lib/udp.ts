// UDP: a game client sends its position 20 times a second. Each datagram stands
// alone: no handshake, no acknowledgement, no retransmission, no ordering.

export const HEADER_BYTES = 8; // source port, destination port, length, checksum: 2 bytes each
export const PAYLOAD_BYTES = 24; // sequence number + x, y, z position + a timestamp
export const INTERVAL = 50; // ms between updates (20 per second)
export const ONE_WAY = 30; // ms from client to server
export const COUNT = 10;
export const REORDER_DELAY = 60; // extra delay on one datagram when reordering is on
export const SRC_PORT = 50000;
export const DST_PORT = 27015;

// A fixed "random" draw per datagram, so the same loss rate always loses the same ones.
const DRAW = [0.42, 0.07, 0.77, 0.26, 0.91, 0.55, 0.16, 0.68, 0.33, 0.85];

export type Datagram = {
  n: number;
  sent: number;
  arrive: number | null; // null = lost
  fate: "used" | "lost" | "stale"; // stale = arrived after a newer one, so the game ignores it
};

export function run(lossPct: number, reorder: boolean): Datagram[] {
  const list: Datagram[] = Array.from({ length: COUNT }, (_, i) => {
    const n = i + 1;
    const sent = i * INTERVAL;
    const lost = DRAW[i] < lossPct / 100;
    const extra = reorder && n === 6 ? REORDER_DELAY : 0;
    return { n, sent, arrive: lost ? null : sent + ONE_WAY + extra, fate: lost ? "lost" : "used" };
  });
  // The game keeps only the newest position: anything older than one it already has is dropped.
  const byArrival = list.filter((d) => d.arrive !== null).sort((a, b) => a.arrive! - b.arrive!);
  let newest = 0;
  for (const d of byArrival) {
    if (d.n < newest) d.fate = "stale";
    else newest = d.n;
  }
  return list;
}

export const hex4 = (n: number) => n.toString(16).padStart(4, "0");

export function header() {
  const length = HEADER_BYTES + PAYLOAD_BYTES;
  return [
    { name: "source port", value: String(SRC_PORT), hex: hex4(SRC_PORT) },
    { name: "destination port", value: String(DST_PORT), hex: hex4(DST_PORT) },
    { name: "length", value: `${length} bytes`, hex: hex4(length) },
    { name: "checksum", value: "catches damage", hex: "····" },
  ];
}
