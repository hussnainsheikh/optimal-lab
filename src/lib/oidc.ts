// OpenID Connect: OAuth plus an ID token that says who the user is.
// The app checks the token's signature with the provider's published key, then the claims:
// issuer, audience, expiry and the nonce it sent. Only then does it sign the user in by (iss, sub).
// The signature is toy RSA (n = 3233) over a tiny hash, so it can be checked by hand; real providers use RS256 or ES256.

export const ISSUER = "https://id.example.com";
export const CLIENT_ID = "shop-web";
export const NONCE = "n-8Kq2xZ";
export const IAT = 1792227600; // 2026-10-17 09:00:00 UTC
export const LIFETIME_MIN = 60;

export const JWK = { kid: "key-2026-10", kty: "RSA (toy)", n: 3233, e: 17 };
const D = 2753; // the provider's private key, never published

export const modpow = (b: number, e: number, m: number) => {
  let r = 1;
  b %= m;
  while (e > 0) {
    if (e & 1) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1;
  }
  return r;
};

/** A tiny hash (FNV-1a reduced mod n) standing in for SHA-256. */
export function tinyHash(s: string, n = JWK.n): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h % n;
}

export function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = [abc[(n >> 18) & 63], abc[(n >> 12) & 63], abc[(n >> 6) & 63], abc[n & 63]];
    out += chars.slice(0, i + 2 < bytes.length ? 4 : i + 1 < bytes.length ? 3 : 2).join("");
  }
  return out;
}

export type Case = "valid" | "other-app" | "wrong-issuer" | "replayed" | "edited";
export const CASES: { id: Case; label: string }[] = [
  { id: "valid", label: "Fresh token for this app" },
  { id: "other-app", label: "Token issued to another app" },
  { id: "wrong-issuer", label: "Signed by a different provider" },
  { id: "replayed", label: "Old token replayed" },
  { id: "edited", label: "Email edited in transit" },
];

export type Claims = {
  iss: string; sub: string; aud: string; exp: number; iat: number; nonce: string;
  email: string; email_verified: boolean; name: string;
};

export function claimsFor(c: Case): Claims {
  const base: Claims = {
    iss: ISSUER, sub: "248289761001", aud: CLIENT_ID, iat: IAT, exp: IAT + LIFETIME_MIN * 60, nonce: NONCE,
    email: "ada@example.com", email_verified: true, name: "Ada Lovelace",
  };
  if (c === "other-app") return { ...base, aud: "quiz-game" };
  if (c === "wrong-issuer") return { ...base, iss: "https://login.other.example" };
  if (c === "replayed") return { ...base, nonce: "n-Qd71aP" };
  return base;
}

export function token(c: Case) {
  const header = JSON.stringify({ alg: "RS256", kid: JWK.kid, typ: "JWT" });
  const signedClaims = claimsFor(c);
  const h = b64url(header);
  const p = b64url(JSON.stringify(signedClaims));
  const signingInput = `${h}.${p}`;
  // A different provider signs with its own key; here, a different private exponent for a different n.
  const sig = c === "wrong-issuer" ? modpow(tinyHash(signingInput, 3127), 2011, 3127) : modpow(tinyHash(signingInput), D, JWK.n);
  // In transit, someone swaps the email after it was signed.
  const received = c === "edited" ? { ...signedClaims, email: "mallory@example.com" } : signedClaims;
  const pReceived = b64url(JSON.stringify(received));
  return { header, claims: received, compact: `${h}.${pReceived}.${sig}`, signingInput: `${h}.${pReceived}`, sig };
}

export type Check = { id: string; label: string; pass: boolean; detail: string };

/** All checks an app must run, given minutes since the token was issued. */
export function verify(c: Case, minutesLater: number) {
  const t = token(c);
  const now = IAT + minutesLater * 60;
  const expected = tinyHash(t.signingInput);
  const recovered = modpow(t.sig, JWK.e, JWK.n);
  const list: Check[] = [
    { id: "sig", label: "Signature matches the provider's key", pass: expected === recovered, detail: `hash(header.payload) = ${expected}; signature^${JWK.e} mod ${JWK.n} = ${recovered}` },
    { id: "iss", label: "iss is the provider we asked", pass: t.claims.iss === ISSUER, detail: `iss = ${t.claims.iss}` },
    { id: "aud", label: "aud is our client id", pass: t.claims.aud === CLIENT_ID, detail: `aud = ${t.claims.aud}, ours is ${CLIENT_ID}` },
    { id: "exp", label: "Not expired", pass: now < t.claims.exp, detail: `${minutesLater} min after issue; expires after ${LIFETIME_MIN} min` },
    { id: "nonce", label: "nonce is the one we sent", pass: t.claims.nonce === NONCE, detail: `nonce = ${t.claims.nonce}, we sent ${NONCE}` },
  ];
  const ok = list.every((x) => x.pass);
  return { token: t, list, ok, firstFail: list.findIndex((x) => !x.pass) };
}
