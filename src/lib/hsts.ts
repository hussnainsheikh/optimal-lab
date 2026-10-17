// A visitor types "bank.example" on café Wi-Fi run by someone who can read and change plain HTTP.
// What reaches the bank, and is any of it in the clear, depends on the site's setup
// and on whether the browser already knows (from HSTS) to use HTTPS.

export type Setup = "http-only" | "redirect" | "hsts" | "preload";
export const SETUPS: { id: Setup; label: string }[] = [
  { id: "http-only", label: "No HTTPS redirect" },
  { id: "redirect", label: "Redirect to HTTPS" },
  { id: "hsts", label: "Redirect + HSTS header" },
  { id: "preload", label: "HSTS preloaded" },
];

export const MAX_AGE_DAYS = 365;
export const HEADER = "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload";

export type Hop = { from: "browser" | "wifi" | "bank"; to: "browser" | "wifi" | "bank"; label: string; plain: boolean };

export type Result = {
  /** Does the browser have a live HSTS entry for the site before this visit? */
  known: boolean;
  knownWhy: string;
  firstUrl: string;
  /** Requests on the wire, in order. */
  wire: { line: string; plain: boolean; note: string }[];
  /** Could the Wi-Fi attacker read or change something? */
  exposed: boolean;
  /** What the attacker can do with the plain request, if anything. */
  risk: string;
  /** Does the browser store (or refresh) an HSTS entry after this visit? */
  remembers: boolean;
};

/**
 * @param setup what the site does
 * @param firstVisit true if this browser has never visited the site
 * @param daysSince days since the last visit (ignored on a first visit)
 */
export function visit(setup: Setup, firstVisit: boolean, daysSince: number): Result {
  const preload = setup === "preload";
  const fromHeader = setup === "hsts" || setup === "preload";
  const stored = fromHeader && !firstVisit && daysSince <= MAX_AGE_DAYS;
  const known = preload || stored;
  const knownWhy = preload
    ? "bank.example is on the preload list built into the browser."
    : stored
      ? `Saved from the header ${daysSince} day${daysSince === 1 ? "" : "s"} ago; it lasts ${MAX_AGE_DAYS} days.`
      : fromHeader && !firstVisit
        ? `The saved entry expired: ${daysSince} days is past max-age (${MAX_AGE_DAYS} days).`
        : firstVisit
          ? "First visit: the browser has never seen this site's header."
          : "The site never sent an HSTS header, so there is nothing to remember.";

  if (known) {
    return {
      known, knownWhy, firstUrl: "https://bank.example/",
      wire: [{ line: "GET https://bank.example/  (TLS)", plain: false, note: "The browser upgraded the URL itself (an internal 307) before anything left the laptop." }],
      exposed: false, risk: "Nothing in the clear. The attacker sees an encrypted connection to bank.example and cannot strip it.",
      remembers: fromHeader,
    };
  }
  if (setup === "http-only") {
    return {
      known, knownWhy, firstUrl: "http://bank.example/",
      wire: [
        { line: "GET http://bank.example/", plain: true, note: "Typed without a scheme, so the browser tries plain HTTP." },
        { line: "POST http://bank.example/login  user=ada&password=…", plain: true, note: "The whole visit stays on HTTP." },
      ],
      exposed: true, risk: "Everything is readable and changeable: the login form, the password, the session cookie.", remembers: false,
    };
  }
  return {
    known, knownWhy, firstUrl: "http://bank.example/",
    wire: [
      { line: "GET http://bank.example/", plain: true, note: "Typed without a scheme, so the first request is plain HTTP." },
      { line: "301 Location: https://bank.example/", plain: true, note: "The redirect itself travels in the clear." },
      { line: "GET https://bank.example/  (TLS)", plain: false, note: "Only now does the connection become encrypted." },
    ],
    exposed: true,
    risk: "The attacker can answer the first plain request themselves and never send the redirect, keeping the visitor on an HTTP copy of the site (SSL stripping).",
    remembers: fromHeader,
  };
}
