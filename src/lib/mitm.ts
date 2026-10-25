// Man-in-the-middle attacks, and what stops them. Someone who controls the path a client uses
// (a rogue café access point, ARP spoofing on a shared LAN, or a poisoned DNS answer) can read
// and change anything sent in the clear. The whole point of TLS is to make that position useless:
// the server proves its identity with a certificate signed by a trusted authority, so an attacker
// who can't forge that signature can only watch encrypted bytes. This file works out, for each
// position and each protection, what the attacker ends up with. It's about why the defences work,
// not how to run the attack. Timings and the example site are illustrative.

export type Position = "rogueAp" | "arpSpoof" | "dnsSpoof";
export const POSITION: Record<Position, { label: string; where: string; how: string }> = {
  rogueAp: { label: "Rogue Wi-Fi hotspot", where: "the café", how: "A laptop advertises “Free Cafe WiFi”; phones that auto-join route everything through it." },
  arpSpoof: { label: "ARP spoofing", where: "a shared LAN", how: "The attacker tells everyone it is the router, so the LAN's traffic flows through its machine." },
  dnsSpoof: { label: "DNS spoofing", where: "the resolver", how: "A forged DNS answer points the name at the attacker's address before the real one arrives." },
};

export type Protection = "http" | "https" | "hsts" | "pinned";
export const PROTECTION: Record<Protection, { label: string; short: string }> = {
  http: { label: "Plain HTTP", short: "no encryption" },
  https: { label: "HTTPS, first visit over HTTP", short: "TLS, but the first hop can be stripped" },
  hsts: { label: "HTTPS + HSTS preload", short: "the browser refuses HTTP for this site" },
  pinned: { label: "HTTPS + certificate pinning", short: "the app only trusts one key" },
};

export type Attempt = "pass" | "read" | "strip" | "fakeCert" | "pinnedFake";
export const ATTEMPT_LABEL: Record<Attempt, string> = {
  pass: "Just forward it",
  read: "Read the plaintext",
  strip: "Serve the site over HTTP (SSL strip)",
  fakeCert: "Present the attacker's own certificate",
  pinnedFake: "Present the attacker's certificate to a pinning app",
};

export type Outcome = {
  sees: string; // what the attacker reads
  canChange: boolean;
  caught: boolean;
  by: string; // what catches it, or ""
  userSees: string;
};

// What the attacker gets, given the position, the site's protection, and what they try.
export function outcome(p: Protection, a: Attempt): Outcome {
  if (p === "http")
    return a === "pass"
      ? { sees: "everything: the page, your login, your session cookie", canChange: true, caught: false, by: "", userSees: "the page loads normally; nothing warns them" }
      : { sees: "everything, and it can be rewritten in flight", canChange: true, caught: false, by: "", userSees: "a page that may have been altered, with no warning" };
  if (a === "read")
    return { sees: "only which site (the SNI and certificate name) and how much data; the contents are encrypted", canChange: false, caught: false, by: "", userSees: "a normal padlock; the attacker learns the destination, not the data" };
  if (a === "strip") {
    if (p === "https") return { sees: "everything, if the user doesn't notice the missing padlock", canChange: true, caught: false, by: "", userSees: "no padlock, and the address stays http://; an alert user notices" };
    return { sees: "nothing", canChange: false, caught: true, by: "HSTS: the browser was told to only ever use HTTPS for this site, so it refuses the HTTP version", userSees: "the browser upgrades to HTTPS on its own; the strip never happens" };
  }
  if (a === "fakeCert")
    return { sees: "nothing usable", canChange: false, caught: true, by: "certificate validation: the attacker can't get a trusted authority to sign a certificate for a name it doesn't control", userSees: "a full-page “Your connection is not private” warning" };
  if (a === "pinnedFake")
    return { sees: "nothing", canChange: false, caught: true, by: "pinning: the app ships the real public key and rejects any other, even a validly signed one", userSees: "the app simply refuses to connect" };
  // pass, on an encrypted site
  return { sees: "encrypted bytes and the destination name", canChange: false, caught: false, by: "", userSees: "the site loads normally and securely" };
}

// Which attempts are available for a given protection (what the attacker would actually try).
export function attempts(p: Protection): Attempt[] {
  if (p === "http") return ["pass", "read"];
  if (p === "https") return ["read", "strip", "fakeCert"];
  if (p === "hsts") return ["read", "strip", "fakeCert"];
  return ["read", "fakeCert", "pinnedFake"];
}

// The best the attacker can do against each protection: the most damaging uncaught outcome.
export function best(p: Protection): { attempt: Attempt; o: Outcome } {
  const scored = attempts(p).map((a) => ({ attempt: a, o: outcome(p, a) }));
  const uncaught = scored.filter((s) => !s.o.caught);
  const pick = uncaught.find((s) => s.o.canChange) ?? uncaught[0] ?? scored[0];
  return pick;
}

export type Safety = "exposed" | "metadata" | "safe";
export function safety(p: Protection): Safety {
  const b = best(p);
  if (b.o.caught) return "safe";
  if (b.o.canChange) return "exposed";
  return "metadata";
}

// Does this protection depend on the user noticing something?
export const needsVigilance = (p: Protection) => p === "https";
