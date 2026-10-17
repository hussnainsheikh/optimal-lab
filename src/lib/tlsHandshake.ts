// A TLS 1.3 handshake, message by message (RFC 8446), and what each party can read.
// Key exchange uses toy Diffie-Hellman numbers (p = 23, g = 5) so the shared secret can be checked by hand;
// real TLS uses X25519 with 32-byte keys.

export const P = 23;
export const G = 5;
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

export const CLIENT_SECRET = 6;
export const SERVER_SECRET = 15;
export const CLIENT_SHARE = modpow(G, CLIENT_SECRET, P); // 8
export const SERVER_SHARE = modpow(G, SERVER_SECRET, P); // 19
export const SHARED = modpow(SERVER_SHARE, CLIENT_SECRET, P); // 2, same as modpow(CLIENT_SHARE, SERVER_SECRET, P)

/** Which keys protect a message: none, handshake keys, or application keys. */
export type Protection = "plain" | "handshake" | "app";
export type Side = "browser" | "server";
export type Scenario = "normal" | "fake-cert";
export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "normal", label: "Real server" },
  { id: "fake-cert", label: "Impostor with a fake certificate" },
];
export type Viewer = "browser" | "observer";
export const VIEWERS: { id: Viewer; label: string }[] = [
  { id: "browser", label: "What the browser reads" },
  { id: "observer", label: "What the Wi-Fi sees" },
];

export type Msg = {
  id: string;
  from: Side;
  name: string;
  /** Contents in plain words, as the endpoints read them. */
  body: string;
  /** What a network observer learns from this message. */
  seen: string;
  bytes: number;
  protection: Protection;
  /** Which flow step (0-based) this message belongs to. */
  step: number;
  bad?: boolean;
};

export function messages(s: Scenario): Msg[] {
  const fake = s === "fake-cert";
  const list: Msg[] = [
    {
      id: "ch", from: "browser", name: "ClientHello", step: 0, bytes: 517, protection: "plain",
      body: `TLS 1.3, ciphers [AES-128-GCM, ChaCha20], name: shop.example, random: 3f9a…, key_share: ${CLIENT_SHARE}`,
      seen: `Everything: the site name shop.example (SNI), the cipher list and key share ${CLIENT_SHARE}.`,
    },
    {
      id: "sh", from: "server", name: "ServerHello", step: 1, bytes: 122, protection: "plain",
      body: `TLS 1.3, cipher AES-128-GCM, random: c41e…, key_share: ${SERVER_SHARE}`,
      seen: `The chosen cipher and key share ${SERVER_SHARE}. Not enough to work out the secret.`,
    },
    {
      id: "ee", from: "server", name: "EncryptedExtensions", step: 2, bytes: 36, protection: "handshake",
      body: "ALPN: h2 (speak HTTP/2), no other options",
      seen: "36 encrypted bytes.",
    },
    {
      id: "cert", from: "server", name: "Certificate", step: 3, bytes: 2840, protection: "handshake", bad: fake,
      body: fake ? "shop.example, issued by “Totally Real CA”, which no browser trusts" : "shop.example, issued by R11 (Let's Encrypt), chains to ISRG Root X1",
      seen: "About 2.8 KB of encrypted bytes. In TLS 1.2 the certificate was sent in the clear.",
    },
    {
      id: "cv", from: "server", name: "CertificateVerify", step: 3, bytes: 264, protection: "handshake",
      body: "a signature over every message so far, made with the certificate's private key",
      seen: "264 encrypted bytes.",
    },
    {
      id: "sfin", from: "server", name: "Finished", step: 4, bytes: 52, protection: "handshake",
      body: "a MAC over the whole handshake: proves nobody changed a message",
      seen: "52 encrypted bytes.",
    },
  ];
  if (fake) {
    list.push({
      id: "alert", from: "browser", name: "Alert: bad_certificate", step: 3, bytes: 24, protection: "handshake", bad: true,
      body: "The chain does not lead to a trusted root. The browser closes the connection and shows a warning page.",
      seen: "A short encrypted message, then the connection closes.",
    });
    return list;
  }
  list.push(
    {
      id: "cfin", from: "browser", name: "Finished", step: 4, bytes: 52, protection: "handshake",
      body: "the browser's MAC over the whole handshake",
      seen: "52 encrypted bytes.",
    },
    {
      id: "req", from: "browser", name: "Application data", step: 5, bytes: 412, protection: "app",
      body: "GET /account  Cookie: session=7d2f…",
      seen: "412 encrypted bytes. The path, the cookie and the page are hidden.",
    },
    {
      id: "res", from: "server", name: "Application data", step: 5, bytes: 18230, protection: "app",
      body: "200 OK  <html>Your orders…",
      seen: "About 18 KB of encrypted bytes.",
    },
  );
  return list;
}

/** One round trip before the first request in TLS 1.3 (TLS 1.2 needed two). */
export const ROUND_TRIPS = 1;

/** Short fake ciphertext for display, derived from the message so it is stable between renders. */
export function scramble(text: string, len = 24): string {
  let h = 2166136261;
  let out = "";
  for (let i = 0; out.length < len; i++) {
    h ^= text.charCodeAt(i % Math.max(1, text.length)) + i;
    h = Math.imul(h, 16777619) >>> 0;
    out += (h & 0xffff).toString(16).padStart(4, "0");
  }
  return out.slice(0, len);
}
