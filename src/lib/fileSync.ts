// Design file sync. A 1 MB file is split into chunks, each chunk is hashed, and only
// chunks the server doesn't already have are uploaded. Two ways to cut chunks:
//   fixed            every 16 KB
//   content-defined  a rolling (gear) hash over the bytes picks the boundaries, so they
//                    move with the content when bytes are inserted
// Everything here runs on real bytes.

export const FILE_BYTES = 1 << 20;
export const FIXED = 16 * 1024;
export const CDC_MIN = 4 * 1024;
export const CDC_MAX = 64 * 1024;
export const CDC_MASK = (1 << 14) - 1; // boundary about every 16 KB on average

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GEAR = (() => {
  const r = mulberry32(99);
  return Array.from({ length: 256 }, () => Math.floor(r() * 2 ** 32) >>> 0);
})();

export function makeFile(seed = 1, size = FILE_BYTES) {
  const r = mulberry32(seed);
  const b = new Uint8Array(size);
  for (let i = 0; i < size; i++) b[i] = Math.floor(r() * 256);
  return b;
}

function fnv(b: Uint8Array) {
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i], 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0");
}

export type Chunking = "fixed" | "cdc";
export type Chunk = { start: number; size: number; hash: string };

export function chunk(b: Uint8Array, how: Chunking): Chunk[] {
  const out: Chunk[] = [];
  if (how === "fixed") {
    for (let s = 0; s < b.length; s += FIXED) out.push({ start: s, size: Math.min(FIXED, b.length - s), hash: fnv(b.subarray(s, s + FIXED)) });
    return out;
  }
  let start = 0;
  let h = 0;
  for (let i = 0; i < b.length; i++) {
    h = ((h << 1) + GEAR[b[i]]) >>> 0;
    const len = i - start + 1;
    if ((len >= CDC_MIN && (h & CDC_MASK) === 0) || len >= CDC_MAX) {
      out.push({ start, size: len, hash: fnv(b.subarray(start, i + 1)) });
      start = i + 1;
      h = 0;
    }
  }
  if (start < b.length) out.push({ start, size: b.length - start, hash: fnv(b.subarray(start)) });
  return out;
}

export type Scenario = "first" | "insert" | "append" | "copy";
export const SCENARIOS: { id: Scenario; label: string; one: string }[] = [
  { id: "first", label: "First upload", one: "A new file the server has never seen." },
  { id: "insert", label: "Insert near the start", one: "Insert 100 bytes 40 KB into the file: a sentence added near the top of a document." },
  { id: "append", label: "Append at the end", one: "Add 100 bytes at the end of the file, like a log line." },
  { id: "copy", label: "Someone else's copy", one: "Another user uploads the same file, byte for byte." },
];
export const INSERT_AT = 40 * 1024;
export const INSERT_BYTES = 100;

const BASE = makeFile(1);
const EXTRA = makeFile(2, INSERT_BYTES);

export function versionFor(s: Scenario) {
  if (s === "insert") {
    const b = new Uint8Array(BASE.length + INSERT_BYTES);
    b.set(BASE.subarray(0, INSERT_AT), 0);
    b.set(EXTRA, INSERT_AT);
    b.set(BASE.subarray(INSERT_AT), INSERT_AT + INSERT_BYTES);
    return b;
  }
  if (s === "append") {
    const b = new Uint8Array(BASE.length + INSERT_BYTES);
    b.set(BASE, 0);
    b.set(EXTRA, BASE.length);
    return b;
  }
  return BASE;
}

const cache = new Map<string, ReturnType<typeof computeUpload>>();
function computeUpload(s: Scenario, how: Chunking, dedupe: boolean) {
  // what the server already holds before this upload
  const known = new Set(s === "first" ? [] : chunk(BASE, how).map((c) => c.hash));
  const chunks = chunk(versionFor(s), how);
  const missing = dedupe ? chunks.filter((c) => !known.has(c.hash)) : chunks;
  return {
    chunks,
    missing: new Set(missing.map((c) => c.start)),
    uploadBytes: missing.reduce((a, c) => a + c.size, 0),
    fileBytes: chunks.reduce((a, c) => a + c.size, 0),
  };
}
export function upload(s: Scenario, how: Chunking, dedupe: boolean) {
  const key = `${s}-${how}-${dedupe}`;
  if (!cache.has(key)) cache.set(key, computeUpload(s, how, dedupe));
  return cache.get(key)!;
}

// Two devices edit version 3 while offline; the server accepts whichever commits first.
export function commit(baseVersion: number, head: number) {
  return baseVersion === head ? { ok: true, note: `Committed as version ${head + 1}.` } : { ok: false, note: `Based on version ${baseVersion}, but the server is at ${head}: saved as “report (Sam's conflicted copy).docx”.` };
}

export const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`);
