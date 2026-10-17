// Passkeys (WebAuthn): the device makes a key pair per site. The site keeps only the public key.
// To sign in, the site sends a random challenge; the browser adds the page's real origin; the
// authenticator signs both after a fingerprint or PIN; the site checks the signature with the stored public key.
// Signatures here are toy RSA (n = 3233) over a tiny hash so they can be checked by hand; real passkeys use ES256 (P-256).

export const RP_ID = "bank.example";
export const RP_ORIGIN = "https://bank.example";
export const LOOKALIKE = "bank-example.co";

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

export function tinyHash(s: string, n: number): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h % n;
}

/** The key pair the authenticator creates for bank.example (p = 61, q = 53). The private d never leaves the device. */
export const CREDENTIAL = { id: "cred_Yk3p", rpId: RP_ID, n: 3233, e: 17, d: 2753 };

export type Mode = "register" | "signin";
export const MODES: { id: Mode; label: string }[] = [
  { id: "register", label: "Create a passkey" },
  { id: "signin", label: "Sign in" },
];
export type Site = "real" | "lookalike";
export const SITES: { id: Site; label: string }[] = [
  { id: "real", label: `The real ${RP_ID}` },
  { id: "lookalike", label: `Look-alike ${LOOKALIKE}` },
];

/** A short challenge from a counter, so renders are stable; real sites use 16+ random bytes. */
export function challenge(k: number): string {
  let x = (k + 1) * 2654435761;
  let out = "";
  for (let i = 0; i < 4; i++) {
    x = Math.imul(x ^ (x >>> 13), 0x5bd1e995) >>> 0;
    out += (x & 0xffff).toString(16).padStart(4, "0");
  }
  return out;
}

export type Run = {
  origin: string;
  rpId: string;
  clientData: string;
  /** Did the authenticator find a key for this rpId? */
  hasKey: boolean;
  /** Did the user unlock the authenticator? */
  unlocked: boolean;
  hash: number | null;
  signature: number | null;
  recovered: number | null;
  checks: { label: string; pass: boolean | null }[];
  ok: boolean;
  summary: string;
};

/**
 * One ceremony.
 * @param site where the user actually is
 * @param uv did the fingerprint / PIN succeed
 * @param k challenge counter
 */
export function ceremony(mode: Mode, site: Site, uv: boolean, k: number): Run {
  const origin = site === "real" ? RP_ORIGIN : `https://${LOOKALIKE}`;
  // A page may only ask for its own domain as rpId; the browser enforces this.
  const rpId = site === "real" ? RP_ID : LOOKALIKE;
  const ch = challenge(k);
  const clientData = JSON.stringify({ type: mode === "register" ? "webauthn.create" : "webauthn.get", challenge: ch, origin });

  if (!uv) {
    return { origin, rpId, clientData, hasKey: mode === "signin" ? site === "real" : true, unlocked: false, hash: null, signature: null, recovered: null,
      checks: [], ok: false, summary: "The fingerprint didn't match, so the authenticator won't use the key. Nothing is sent." };
  }

  if (mode === "register") {
    const ok = site === "real";
    return {
      origin, rpId, clientData, hasKey: true, unlocked: true, hash: null, signature: null, recovered: null,
      checks: [
        { label: `Challenge is ${ch}, the one the server sent`, pass: true },
        { label: `Origin is ${RP_ORIGIN}`, pass: ok },
      ],
      ok,
      summary: ok
        ? `A new key pair for ${RP_ID}. The server stores the credential id and public key (n = ${CREDENTIAL.n}, e = ${CREDENTIAL.e}). No secret is stored on the server.`
        : `The passkey is created for ${LOOKALIKE}, not for the bank. It can only ever be used on ${LOOKALIKE}.`,
    };
  }

  const hasKey = rpId === CREDENTIAL.rpId;
  if (!hasKey) {
    return {
      origin, rpId, clientData, hasKey, unlocked: true, hash: null, signature: null, recovered: null,
      checks: [{ label: `Authenticator has a passkey for ${rpId}`, pass: false }],
      ok: false,
      summary: `The device has a passkey for ${RP_ID} only. On ${LOOKALIKE} there is nothing to offer, so there is nothing to phish.`,
    };
  }
  const h = tinyHash(`${rpId}|${clientData}`, CREDENTIAL.n);
  const signature = modpow(h, CREDENTIAL.d, CREDENTIAL.n);
  const recovered = modpow(signature, CREDENTIAL.e, CREDENTIAL.n);
  const checks = [
    { label: `Signature checks out with the stored public key (${recovered} = ${h})`, pass: recovered === h },
    { label: `Challenge ${ch} is the one this server just issued`, pass: true },
    { label: `Origin is ${RP_ORIGIN}`, pass: origin === RP_ORIGIN },
    { label: "User verified (fingerprint or PIN) flag is set", pass: true },
  ];
  const ok = checks.every((c) => c.pass);
  return { origin, rpId, clientData, hasKey, unlocked: true, hash: h, signature, recovered, checks, ok,
    summary: ok ? "Signed in. No password was typed or sent, and the server never held a secret that could leak." : "Rejected." };
}
