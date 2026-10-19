// Three ways to keep a user signed in, and one bad afternoon. At minute 0 Sara
// signs in. At minute 30 her credential leaks. At minute 40 she clicks "sign out of
// every device". How long the attacker keeps access, what each request costs the
// server, and whether the leak could happen at all depend on the design and on where
// the browser keeps the credential.

export type Design = "session" | "jwt" | "refresh";
export type Storage = "cookie" | "localStorage";
export type Leak = "xss" | "log";

export const DESIGNS: { id: Design; label: string; one: string }[] = [
  { id: "session", label: "Server session", one: "A random id in a cookie; the server looks it up in Redis on every request." },
  { id: "jwt", label: "Long-lived JWT", one: "A signed token valid for 24 hours; the server checks the signature and looks nothing up." },
  { id: "refresh", label: "Short access + refresh", one: "A JWT valid for minutes, plus a refresh token the server stores, rotates on every use and can revoke." },
];

export const ACCESS_TTLS = [5, 15, 60];
export const JWT_TTL_MIN = 24 * 60;
export const REFRESH_TTL_DAYS = 30;
export const LEAK_AT = 30;
export const REVOKE_AT = 40;
export const REQ_PER_MIN = 20_000; // across all users
export const LOOKUP_MS = 0.4; // Redis round trip in the same zone
export const VERIFY_MS = 0.05; // checking an ES256 signature

export type Settings = { design: Design; storage: Storage; leak: Leak; accessTtl: number; reuseDetection: boolean };
export const START: Settings = { design: "jwt", storage: "localStorage", leak: "xss", accessTtl: 15, reuseDetection: true };

export type Result = {
  stolen: string; // what the attacker got
  leaked: boolean;
  attackerUntil: number | null; // minute access ends (null: no access)
  windowAfterRevoke: number; // minutes of access after Sara revoked
  revokeWorks: string;
  lookupsPerMin: number;
  msPerRequest: number;
  csrfNeeded: boolean;
  notes: string[];
};

export function run(s: Settings): Result {
  // Can the attacker read the credential?
  const xssCanRead = s.storage === "localStorage";
  const leaked = s.leak === "log" || xssCanRead;
  const notes: string[] = [];
  if (s.leak === "xss" && !xssCanRead)
    notes.push("An HttpOnly cookie is invisible to JavaScript, so the injected script can't read it. It can still make requests from Sara's open tab while it runs, so XSS still has to be fixed.");
  if (s.leak === "xss" && xssCanRead) notes.push("Injected script reads localStorage and sends the token to the attacker, who can use it from anywhere.");
  if (s.leak === "log") notes.push("A debug log printed the request headers; anyone with log access has the credential, wherever the browser kept it.");

  const stolen = !leaked ? "nothing it can take away" : s.design === "session" ? "the session id" : s.design === "jwt" ? "a 24-hour JWT" : s.storage === "localStorage" ? "the access and refresh tokens" : "the access token and the refresh token";

  let attackerUntil: number | null = null;
  let revokeWorks = "";
  if (leaked) {
    if (s.design === "session") {
      attackerUntil = REVOKE_AT;
      revokeWorks = "Signing out deletes the session in Redis; the next request with the stolen id gets 401.";
    } else if (s.design === "jwt") {
      attackerUntil = JWT_TTL_MIN;
      revokeWorks = "Nothing to delete: the token is valid until it expires, unless every request checks a blocklist, which is a lookup again.";
    } else {
      // The access token in hand lasts until its expiry; the refresh token is revoked at REVOKE_AT,
      // or earlier if rotation spots it being used twice.
      const lastRefresh = Math.floor(LEAK_AT / s.accessTtl) * s.accessTtl; // issued at the last refresh before the leak
      const accessExpiry = lastRefresh + s.accessTtl;
      // Attacker refreshes when the stolen access token expires; Sara's app refreshes at the same boundary with the old token.
      const reuseAt = accessExpiry; // both present the same refresh token: one of them is a reuse
      const familyRevokedAt = s.reuseDetection ? reuseAt : REVOKE_AT;
      const end = Math.min(familyRevokedAt, REVOKE_AT);
      // after the family is revoked, whatever access token the attacker holds still works until it expires
      const heldExpiry = end <= accessExpiry ? accessExpiry : Math.floor(end / s.accessTtl) * s.accessTtl + s.accessTtl;
      attackerUntil = Math.max(accessExpiry, heldExpiry);
      revokeWorks = s.reuseDetection && reuseAt < REVOKE_AT
        ? `At minute ${reuseAt} two clients present the same refresh token. Rotation treats that as theft and revokes the whole family; the access token already out lasts until minute ${attackerUntil}.`
        : `Signing out everywhere at minute ${REVOKE_AT} revokes the refresh token, so no new access tokens; the one already out lasts until minute ${attackerUntil}.`;
    }
  }

  const lookupsPerMin = s.design === "session" ? REQ_PER_MIN : s.design === "jwt" ? 0 : REQ_PER_MIN / 50; // refresh calls, assuming 50 requests per access token
  const msPerRequest = s.design === "session" ? LOOKUP_MS : VERIFY_MS;
  return {
    stolen,
    leaked,
    attackerUntil,
    windowAfterRevoke: attackerUntil === null ? 0 : Math.max(0, attackerUntil - REVOKE_AT),
    revokeWorks: leaked ? revokeWorks : "Nothing leaked.",
    lookupsPerMin,
    msPerRequest,
    csrfNeeded: s.storage === "cookie",
    notes,
  };
}

export function duration(min: number): string {
  if (min >= 60) return `${Math.round((min / 60) * 10) / 10} h`;
  return `${Math.round(min)} min`;
}
