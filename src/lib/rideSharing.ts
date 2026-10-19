// Design ride sharing: drivers report locations, an index by geohash finds the ones
// near a rider, and the trip is offered to one driver at a time. Real geohashes over
// 400 drivers placed with a fixed seed in a 11 × 9 km city.

const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export function encode(lat: number, lng: number, precision: number) {
  let latR = [-90, 90];
  let lngR = [-180, 180];
  let hash = "";
  let bit = 0;
  let ch = 0;
  let even = true;
  while (hash.length < precision) {
    const r = even ? lngR : latR;
    const v = even ? lng : lat;
    const mid = (r[0] + r[1]) / 2;
    if (v >= mid) {
      ch = (ch << 1) | 1;
      r[0] = mid;
    } else {
      ch = ch << 1;
      r[1] = mid;
    }
    if (even) lngR = r;
    else latR = r;
    even = !even;
    if (++bit === 5) {
      hash += B32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

export function bounds(hash: string) {
  const latR = [-90, 90];
  const lngR = [-180, 180];
  let even = true;
  for (const c of hash) {
    const v = B32.indexOf(c);
    for (let i = 4; i >= 0; i--) {
      const b = (v >> i) & 1;
      const r = even ? lngR : latR;
      const mid = (r[0] + r[1]) / 2;
      if (b) r[0] = mid;
      else r[1] = mid;
      even = !even;
    }
  }
  return { lat: latR as [number, number], lng: lngR as [number, number] };
}

// The cell and its 8 neighbours, found by stepping one cell width or height away.
export function neighbours(hash: string) {
  const b = bounds(hash);
  const h = b.lat[1] - b.lat[0];
  const w = b.lng[1] - b.lng[0];
  const cLat = (b.lat[0] + b.lat[1]) / 2;
  const cLng = (b.lng[0] + b.lng[1]) / 2;
  const out: string[] = [];
  for (const dy of [1, 0, -1]) for (const dx of [-1, 0, 1]) out.push(encode(cLat + dy * h, cLng + dx * w, hash.length));
  return out;
}

export const CITY = { lat: [40.7, 40.78] as [number, number], lng: [-74.02, -73.89] as [number, number] };

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Driver = { id: number; lat: number; lng: number };
export const DRIVERS: Driver[] = (() => {
  const r = mulberry32(11);
  return Array.from({ length: 400 }, (_, id) => ({ id, lat: CITY.lat[0] + r() * (CITY.lat[1] - CITY.lat[0]), lng: CITY.lng[0] + r() * (CITY.lng[1] - CITY.lng[0]) }));
})();

export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export const etaMin = (d: number) => (d * 1.4) / (22 / 60); // 1.4× road detour at 22 km/h

export const RIDERS = [
  { id: "a", label: "Rider A", lat: 40.7431, lng: -73.9712 },
  { id: "b", label: "Rider B", lat: 40.7436, lng: -73.9705 },
];
export const PRECISIONS = [5, 6, 7];

export function cellSizeKm(precision: number) {
  const b = bounds(encode(40.74, -73.97, precision));
  return { w: km({ lat: 40.74, lng: b.lng[0] }, { lat: 40.74, lng: b.lng[1] }), h: km({ lat: b.lat[0], lng: -73.97 }, { lat: b.lat[1], lng: -73.97 }) };
}

export function search(rider: { lat: number; lng: number }, precision: number, withNeighbours: boolean, exclude: number[] = []) {
  const own = encode(rider.lat, rider.lng, precision);
  const cells = withNeighbours ? neighbours(own) : [own];
  const set = new Set(cells);
  const pool = DRIVERS.filter((d) => !exclude.includes(d.id));
  const candidates = pool.filter((d) => set.has(encode(d.lat, d.lng, precision)));
  const byDist = (xs: Driver[]) => xs.map((d) => ({ d, km: km(rider, d) })).sort((a, b) => a.km - b.km);
  const found = byDist(candidates)[0] ?? null;
  const truth = byDist(pool)[0];
  return { own, cells, candidates, found, truth, missedNearest: !found || found.d.id !== truth.d.id };
}

// Scale: every online driver sends a location every few seconds.
export const ONLINE_DRIVERS = 1e6;
export const UPDATE_EVERY = [1, 4, 10];
export const RIDE_REQUESTS_PER_S = 2000;
