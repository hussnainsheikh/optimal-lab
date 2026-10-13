// Cross-site request forgery. You're logged in to bank.example. You open evil.example, which
// quietly submits a form to bank.example/transfer. Your browser attaches your bank cookie.
// Which defenses stop it?

export type Defense = "none" | "samesite" | "token" | "origin";

export const DEFENSES: { id: Defense; label: string; how: string }[] = [
  { id: "none", label: "No defense", how: "The bank trusts any request that carries the session cookie." },
  { id: "samesite", label: "SameSite=Lax cookie", how: "Set-Cookie: session=…; SameSite=Lax. The browser leaves it off cross-site POSTs." },
  { id: "token", label: "CSRF token", how: "Every bank form carries a secret token; the server checks it. evil.example can't read it." },
  { id: "origin", label: "Check the Origin header", how: "The server rejects state-changing requests whose Origin isn't bank.example." },
];

export type CsrfStep = { at: "browser" | "evil" | "bank"; text: string; bad?: boolean; good?: boolean };

export function run(d: Defense): CsrfStep[] {
  const s: CsrfStep[] = [
    { at: "bank", text: "You log in to bank.example. It sets a session cookie." },
    { at: "evil", text: "Later you open evil.example. Its page auto-submits a hidden form: POST bank.example/transfer, to=attacker, amount=500." },
  ];
  const cookieSent = d !== "samesite";
  s.push({ at: "browser", text: cookieSent ? "Your browser sends the request with your bank cookie attached, because it's addressed to bank.example." : "SameSite=Lax: it's a cross-site POST, so the browser sends it without the cookie." });
  s.push({ at: "browser", text: "Origin: https://evil.example" });
  if (d === "none") s.push({ at: "bank", text: "Valid session, so the bank moves $500 to the attacker.", bad: true });
  else if (d === "samesite") s.push({ at: "bank", text: "No session cookie: you look logged out. Request refused.", good: true });
  else if (d === "token") s.push({ at: "bank", text: "The cookie is valid, but the form has no CSRF token. Refused.", good: true });
  else s.push({ at: "bank", text: "Origin is evil.example, not bank.example. Refused.", good: true });
  return s;
}
