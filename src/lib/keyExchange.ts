// Diffie-Hellman with tiny public numbers: both sides reach the same secret without sending it.
export const P = 23, G = 5;
export const modpow = (b: number, e: number, m: number) => { let r = 1; b %= m; while (e > 0) { if (e & 1) r = (r * b) % m; b = (b * b) % m; e >>= 1; } return r; };
export function exchange(a: number, b: number) {
  const A = modpow(G, a, P), B = modpow(G, b, P);
  const sA = modpow(B, a, P), sB = modpow(A, b, P);
  // Eve brute-forces a from A: easy here, hopeless with 2048-bit numbers.
  let tries = 0, found = -1;
  for (let x = 1; x < P; x++) { tries++; if (modpow(G, x, P) === A) { found = x; break; } }
  return { A, B, sA, sB, tries, found };
}
