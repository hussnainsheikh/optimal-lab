// Toy RSA signatures (tiny numbers, real maths): sign a hash with the private key, verify with the public key.
export const KEY = { n: 3233, e: 17, d: 2753 }; // p = 61, q = 53
export const MALLORY = { n: 3127, e: 3, d: 2011 }; // p = 59, q = 53
export const MESSAGE = "Pay Bob $10";

export const modpow = (b: number, e: number, m: number) => {
  let r = 1; b %= m;
  while (e > 0) { if (e & 1) r = (r * b) % m; b = (b * b) % m; e >>= 1; }
  return r;
};
export const hash = (s: string, n = KEY.n) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 100003; return h % n; };

export type Case = "genuine" | "tampered" | "forged";
export const CASES: { id: Case; label: string }[] = [
  { id: "genuine", label: "Alice signs it" },
  { id: "tampered", label: "Someone edits the message" },
  { id: "forged", label: "Mallory signs with her key" },
];

export function scenario(c: Case) {
  const signedMsg = MESSAGE;
  const signer = c === "forged" ? MALLORY : KEY;
  const sig = modpow(hash(signedMsg, signer.n), signer.d, signer.n);
  const received = c === "tampered" ? "Pay Bob $1000" : MESSAGE;
  const h = hash(received);
  const recovered = modpow(sig, KEY.e, KEY.n);
  return { signedMsg, received, sig, h, recovered, valid: h === recovered, signerName: c === "forged" ? "Mallory" : "Alice" };
}
