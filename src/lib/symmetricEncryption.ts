// Symmetric encryption, small enough to follow:
// - a toy 16-bit block cipher (a 6-round Feistel network with a fixed S-box), keyed by one shared key
// - ECB mode (each block encrypted alone) vs CTR mode (a nonce + counter makes every block different)
// - real AES-GCM through WebCrypto for typed text.
// The toy cipher is for teaching only. It is NOT secure: 16-bit blocks and keys can be searched in a blink.

// A fixed byte permutation (S-box), built once by a seeded shuffle so it is the same everywhere.
const SBOX: number[] = (() => {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let x = 2463534242;
  for (let i = 255; i > 0; i--) {
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    const j = x % (i + 1);
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
})();

export const ROUNDS = 6;

/** One 8-bit round key per round, spread out from the 16-bit key. */
export function roundKeys(key: number): number[] {
  return Array.from({ length: ROUNDS }, (_, i) => SBOX[((key >>> ((i % 2) * 8)) + i * 37) & 255] ^ ((key >>> (i % 3)) & 255));
}

const F = (half: number, k: number) => {
  const a = SBOX[(half ^ k) & 255];
  return ((a << 3) | (a >>> 5)) & 255;
};

/** Encrypt one 16-bit block. */
export function encryptBlock(block: number, key: number): number {
  let l = (block >>> 8) & 255;
  let r = block & 255;
  for (const k of roundKeys(key)) [l, r] = [r, l ^ F(r, k)];
  return (l << 8) | r;
}

/** Decrypt one 16-bit block: the same rounds, keys in reverse. */
export function decryptBlock(block: number, key: number): number {
  let l = (block >>> 8) & 255;
  let r = block & 255;
  for (const k of roundKeys(key).reverse()) [l, r] = [r ^ F(l, k), l];
  return (l << 8) | r;
}

// A 16 × 10 picture (a padlock). Each cell is one 16-bit block: 0x0000 for background, 0xffff for ink.
const ART = [
  "................",
  "......####......",
  ".....#....#.....",
  ".....#....#.....",
  "....########....",
  "....###..###....",
  "....###..###....",
  "....####.###....",
  "....########....",
  "................",
];
export const W = 16;
export const H = 10;
export const PLAIN: number[] = ART.join("").split("").map((c) => (c === "#" ? 0xffff : 0x0000));

export type Mode = "ecb" | "ctr";
export const MODES: { id: Mode; label: string }[] = [
  { id: "ecb", label: "ECB: each block alone" },
  { id: "ctr", label: "CTR: nonce + counter" },
];

/** The value fed to the cipher for block i in CTR mode: nonce in the top byte, counter below. */
export const counterBlock = (nonce: number, i: number) => ((nonce & 255) << 8) | (i & 255);

export function encrypt(plain: number[], key: number, mode: Mode, nonce: number): number[] {
  if (mode === "ecb") return plain.map((b) => encryptBlock(b, key));
  return plain.map((b, i) => b ^ encryptBlock(counterBlock(nonce, i), key));
}

export function decrypt(cipher: number[], key: number, mode: Mode, nonce: number): number[] {
  if (mode === "ecb") return cipher.map((b) => decryptBlock(b, key));
  // CTR decrypts with the same keystream: XOR again.
  return cipher.map((b, i) => b ^ encryptBlock(counterBlock(nonce, i), key));
}

/** How many different values appear, and how often the most common one repeats. */
export function patternStats(blocks: number[]) {
  const counts = new Map<number, number>();
  for (const b of blocks) counts.set(b, (counts.get(b) ?? 0) + 1);
  return { distinct: counts.size, top: Math.max(...counts.values()) };
}

export const hex4 = (n: number) => n.toString(16).padStart(4, "0");
export const bytesHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/**
 * A colour "look" for every block: equal values get equal looks, different values usually differ.
 * Looks are handed out in order of first appearance (20 of them: 5 colour tokens × 4 strengths),
 * so in ECB the background and the ink always look different, and in CTR the picture becomes noise.
 */
export function looks(blocks: number[]) {
  const index = new Map<number, number>();
  return blocks.map((v) => {
    if (!index.has(v)) index.set(v, index.size);
    const k = (index.get(v)! * 7 + 3) % 20;
    return { token: `var(--c${(k % 5) + 1})`, strength: 25 + Math.floor(k / 5) * 25 };
  });
}

// ---- Real AES-256-GCM through WebCrypto (browser or Node 20+) ----

export async function aesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function aesEncrypt(key: CryptoKey, text: string, nonce: Uint8Array): Promise<Uint8Array> {
  const out = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, key, new TextEncoder().encode(text));
  return new Uint8Array(out);
}

/** Returns the text, or null when the tag check fails (wrong key, wrong nonce, or edited bytes). */
export async function aesDecrypt(key: CryptoKey, data: Uint8Array, nonce: Uint8Array): Promise<string | null> {
  try {
    const out = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce as BufferSource }, key, data as BufferSource);
    return new TextDecoder().decode(out);
  } catch {
    return null;
  }
}
