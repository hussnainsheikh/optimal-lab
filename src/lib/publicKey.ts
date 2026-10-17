// Toy RSA encryption with tiny primes (real maths, tiny numbers so you can follow it).
// Anyone can lock with the public key (n, e); only the private key d unlocks.
// Real RSA keys are 2048+ bits and always use padding (OAEP); this toy has neither.

export const modpow = (b: number, e: number, m: number) => {
  let r = 1;
  b %= m;
  while (e > 0) {
    if (e & 1) r = (r * b) % m;
    b = (b * b) % m;
    e = Math.floor(e / 2);
  }
  return r;
};

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Modular inverse by the extended Euclidean algorithm. */
export function modInverse(a: number, m: number): number {
  let [oldR, r] = [a, m];
  let [oldS, s] = [1, 0];
  while (r !== 0) {
    const q = Math.floor(oldR / r);
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  return ((oldS % m) + m) % m;
}

export type PrimePair = "61-53" | "89-97" | "101-113";
export const PAIRS: { id: PrimePair; label: string; p: number; q: number }[] = [
  { id: "61-53", label: "p = 61, q = 53", p: 61, q: 53 },
  { id: "89-97", label: "p = 89, q = 97", p: 89, q: 97 },
  { id: "101-113", label: "p = 101, q = 113", p: 101, q: 113 },
];

export function makeKeys(pair: PrimePair) {
  const { p, q } = PAIRS.find((x) => x.id === pair)!;
  const n = p * q;
  const phi = (p - 1) * (q - 1);
  const e = [3, 5, 7, 11, 13, 17, 19, 23].find((x) => gcd(x, phi) === 1)!;
  const d = modInverse(e, phi);
  return { p, q, n, phi, e, d };
}
export type Keys = ReturnType<typeof makeKeys>;

/** Each character code (0–255, smaller than n) is one number to encrypt. */
export function encryptText(text: string, k: Keys) {
  return Array.from(text).map((ch) => {
    const m = ch.charCodeAt(0) & 255;
    return { ch, m, c: modpow(m, k.e, k.n) };
  });
}

export const decryptNum = (c: number, k: Keys) => modpow(c, k.d, k.n);

/** Characters as a reader would see them, with "·" for values that aren't printable. */
export const show = (codes: number[]) => codes.map((m) => (m >= 32 && m < 127 ? String.fromCharCode(m) : "·")).join("");

/**
 * Why tiny keys are useless: finding p from n by trying every odd number.
 * Counts the tries. For a 2048-bit n this would take longer than the age of the universe.
 */
export function trialDivision(n: number) {
  let tries = 1;
  if (n % 2 === 0) return { p: 2, tries };
  for (let f = 3; f * f <= n; f += 2) {
    tries++;
    if (n % f === 0) return { p: f, tries };
  }
  return { p: n, tries };
}
