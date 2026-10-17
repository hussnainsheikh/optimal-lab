// A server-side session: log in once, the server stores a session under a random id,
// and the browser carries the id back in a cookie. The cookie's flags decide who else can use it.

export type SameSite = "None" | "Lax" | "Strict";
export type Flags = { httpOnly: boolean; secure: boolean; sameSite: SameSite; maxAgeHours: number };
export const DEFAULT_FLAGS: Flags = { httpOnly: false, secure: false, sameSite: "Lax", maxAgeHours: 0 };
export const SAFE_FLAGS: Flags = { httpOnly: true, secure: true, sameSite: "Lax", maxAgeHours: 8 };

export const SESSION_ID = "s_7f3a9c21e04b88d1a6f2c5e9";
export const SESSION = { userId: 42, name: "Ada", createdAt: "09:00", csrfToken: "c1b5…" };

export function setCookieLine(f: Flags): string {
  const parts = [`Set-Cookie: sid=${SESSION_ID}`, "Path=/"];
  if (f.maxAgeHours > 0) parts.push(`Max-Age=${f.maxAgeHours * 3600}`);
  if (f.httpOnly) parts.push("HttpOnly");
  if (f.secure) parts.push("Secure");
  parts.push(`SameSite=${f.sameSite}`);
  return parts.join("; ");
}

export type Event = "normal" | "xss" | "http" | "cross-site" | "browser-closed" | "logout";
export const EVENTS: { id: Event; label: string }[] = [
  { id: "normal", label: "Next page on the site" },
  { id: "xss", label: "Injected script reads cookies" },
  { id: "http", label: "A plain http:// request" },
  { id: "cross-site", label: "evil.example posts a form" },
  { id: "browser-closed", label: "Close and reopen the browser" },
  { id: "logout", label: "Log out, then reuse the old id" },
];

export type Outcome = {
  /** Request line the browser (or the attacker) sends. */
  request: string;
  /** Is the cookie attached to the request? */
  sent: boolean;
  /** Does the server find a live session for it? */
  found: boolean;
  /** Good for the user (true), bad (false). */
  safe: boolean;
  why: string;
  /** Which flag (or server action) decided it. */
  decidedBy: string;
};

/** Current browsers refuse to store a SameSite=None cookie that isn't also Secure. */
export const rejected = (f: Flags) => f.sameSite === "None" && !f.secure;

export function outcome(e: Event, f: Flags): Outcome {
  if (rejected(f)) {
    return { request: "GET https://shop.example/orders", sent: false, found: false, safe: true, why: "The browser never stored the cookie: SameSite=None is only accepted together with Secure. Ada looks logged out on every page.", decidedBy: "SameSite=None without Secure" };
  }
  switch (e) {
    case "normal":
      return { request: "GET https://shop.example/orders", sent: true, found: true, safe: true, why: "Same site, over HTTPS: the browser attaches the cookie and the server finds Ada's session.", decidedBy: "cookie sent" };
    case "xss":
      return f.httpOnly
        ? { request: "document.cookie  →  \"theme=dark\"", sent: false, found: false, safe: true, why: "HttpOnly hides the cookie from JavaScript. The injected script gets an empty answer and has no id to send away.", decidedBy: "HttpOnly" }
        : { request: `document.cookie  →  "sid=${SESSION_ID}"`, sent: true, found: true, safe: false, why: "Without HttpOnly any script on the page can read the id and send it to another server. Whoever holds it is logged in as Ada.", decidedBy: "no HttpOnly" };
    case "http":
      return f.secure
        ? { request: "GET http://shop.example/img/logo.png", sent: false, found: false, safe: true, why: "Secure keeps the cookie off plain HTTP, so nothing on the network sees the id.", decidedBy: "Secure" }
        : { request: `GET http://shop.example/img/logo.png  Cookie: sid=${SESSION_ID}`, sent: true, found: true, safe: false, why: "Without Secure the id travels in the clear on any http:// request, readable by anyone on the same Wi-Fi.", decidedBy: "no Secure" };
    case "cross-site":
      return f.sameSite === "None"
        ? { request: `POST https://shop.example/email  (from evil.example)  Cookie: sid=${SESSION_ID}`, sent: true, found: true, safe: false, why: "SameSite=None sends the cookie on requests started by other sites, so evil.example's form acts as Ada (cross-site request forgery).", decidedBy: "SameSite=None" }
        : { request: "POST https://shop.example/email  (from evil.example)", sent: false, found: false, safe: true, why: `SameSite=${f.sameSite} keeps the cookie off cross-site form posts. The server sees no session and refuses.`, decidedBy: `SameSite=${f.sameSite}` };
    case "browser-closed":
      return f.maxAgeHours > 0
        ? { request: `GET https://shop.example/orders  Cookie: sid=${SESSION_ID}`, sent: true, found: true, safe: true, why: `Max-Age makes it a persistent cookie: it survives a restart and lasts ${f.maxAgeHours} hours. The server should also expire the session on its side.`, decidedBy: `Max-Age=${f.maxAgeHours * 3600}` }
        : { request: "GET https://shop.example/orders", sent: false, found: false, safe: true, why: "With no Max-Age or Expires it is a session cookie: the browser drops it when it closes, so Ada logs in again.", decidedBy: "no Max-Age" };
    case "logout":
      return { request: `GET https://shop.example/orders  Cookie: sid=${SESSION_ID}`, sent: true, found: false, safe: true, why: "Logging out deleted the session on the server. A copy of the old id now points at nothing, whatever the flags say.", decidedBy: "server deleted it" };
  }
}

/** How many of the threats in EVENTS these flags stop (xss, http, cross-site). */
export function score(f: Flags) {
  const threats: Event[] = ["xss", "http", "cross-site"];
  return threats.filter((t) => outcome(t, f).safe).length;
}
