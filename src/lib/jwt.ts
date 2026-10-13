// JSON Web Tokens: header.payload.signature, each part base64url-encoded. Anyone can decode
// the payload; only the signature proves the server issued it. The signature here is a
// simplified stand-in for HMAC-SHA256, so the example runs anywhere.

const b64url = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

function fakeHmac(data: string, secret: string) {
  let h = 2166136261;
  for (const c of secret + "|" + data) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  let out = "";
  for (let i = 0; i < 6; i++) {
    h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0;
    out += h.toString(36);
  }
  return out.slice(0, 43);
}

export const SECRET = "server-secret";
export const NOW = 1_800_000_000;

export type Token = { header: Record<string, unknown>; payload: Record<string, unknown>; signature: string };

export function encode(t: Token) {
  return `${b64url(JSON.stringify(t.header))}.${b64url(JSON.stringify(t.payload))}.${t.signature}`;
}

export function sign(header: Token["header"], payload: Token["payload"], secret = SECRET) {
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  return header.alg === "none" ? "" : fakeHmac(data, secret);
}

const H = { alg: "HS256", typ: "JWT" };
const P = { sub: "user_42", name: "Ada", role: "user", exp: NOW + 3600 };

export type Attack = "valid" | "tamper" | "none" | "expired";

export const ATTACKS: { id: Attack; label: string; note: string }[] = [
  { id: "valid", label: "Real token", note: "Issued and signed by the server." },
  { id: "tamper", label: "Change role to admin", note: "Decode, edit the payload, encode again. The old signature is kept." },
  { id: "none", label: "alg: none", note: "Set the algorithm to none and drop the signature." },
  { id: "expired", label: "Expired token", note: "A real token whose exp is in the past." },
];

export function tokenFor(a: Attack): Token {
  const real = sign(H, P);
  if (a === "tamper") return { header: H, payload: { ...P, role: "admin" }, signature: real };
  if (a === "none") return { header: { alg: "none", typ: "JWT" }, payload: { ...P, role: "admin" }, signature: "" };
  if (a === "expired") {
    const p = { ...P, exp: NOW - 60 };
    return { header: H, payload: p, signature: sign(H, p) };
  }
  return { header: H, payload: P, signature: real };
}

export type Check = { name: string; ok: boolean; detail: string };

export function verify(t: Token, strict: boolean): { accepted: boolean; checks: Check[] } {
  const checks: Check[] = [];
  const alg = String(t.header.alg);
  const algOk = strict ? alg === "HS256" : true;
  checks.push({ name: "Algorithm", ok: algOk, detail: strict ? (algOk ? "HS256, the only one allowed" : `${alg} is not on the allow-list`) : `trusts the header: ${alg}` });
  const expected = alg === "none" && !strict ? "" : sign({ ...t.header, alg: "HS256" }, t.payload);
  const sigOk = alg === "none" && !strict ? true : t.signature === sign(t.header, t.payload) && alg !== "none";
  checks.push({ name: "Signature", ok: sigOk, detail: alg === "none" && !strict ? "skipped: alg is none" : sigOk ? "matches" : `expected ${expected.slice(0, 10)}…, got ${t.signature ? t.signature.slice(0, 10) + "…" : "nothing"}` });
  const exp = Number(t.payload.exp);
  const expOk = exp > NOW;
  checks.push({ name: "Expiry", ok: expOk, detail: expOk ? "still valid" : "expired" });
  return { accepted: checks.every((c) => c.ok), checks };
}
