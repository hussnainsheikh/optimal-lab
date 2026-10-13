// OAuth 2.0 authorization code flow with PKCE, step by step.
export type Lane = "user" | "app" | "auth" | "api" | "attacker";
export type Scenario = "normal" | "stolen-no-pkce" | "stolen-pkce";
export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "normal", label: "Normal sign-in" },
  { id: "stolen-no-pkce", label: "Code stolen, no PKCE" },
  { id: "stolen-pkce", label: "Code stolen, with PKCE" },
];
export type Step = { from: Lane; to: Lane; msg: string; text: string; bad?: boolean; blocked?: boolean };
export function steps(s: Scenario): Step[] {
  const pkce = s !== "stolen-no-pkce";
  const base: Step[] = [
    { from: "user", to: "app", msg: "Sign in with Acme", text: "The user clicks “Sign in”. The app never sees their password." },
    { from: "app", to: "auth", msg: `redirect: /authorize?client_id&redirect_uri&scope=read&state=xyz${pkce ? "&code_challenge=SHA256(verifier)" : ""}`, text: pkce ? "The app sends the browser to the authorization server, with a random state and a hash of a secret verifier it keeps." : "The app sends the browser to the authorization server with its client id, where to come back, the scopes, and a state value." },
    { from: "user", to: "auth", msg: "log in + approve “read orders”", text: "The user logs in at the provider and approves the requested access." },
    { from: "auth", to: "app", msg: "redirect: /callback?code=abc123&state=xyz", text: "The browser comes back with a short-lived code. The app checks state matches what it sent." },
  ];
  if (s === "normal") return [...base,
    { from: "app", to: "auth", msg: `POST /token code=abc123${pkce ? " code_verifier=…" : ""}`, text: "The app's backend swaps the code for tokens, proving it started the flow." },
    { from: "auth", to: "app", msg: "access_token (15 min) + refresh_token", text: "Tokens go to the app server, not through the browser URL." },
    { from: "app", to: "api", msg: "GET /orders  Authorization: Bearer …", text: "The app calls the API with the access token, limited to the approved scope." },
  ];
  return [...base,
    { from: "attacker", to: "auth", msg: "POST /token code=abc123", text: "A malicious app on the device intercepted the redirect and tries to redeem the code first.", bad: true },
    pkce
      ? { from: "auth", to: "attacker", msg: "400 invalid_grant: code_verifier missing", text: "PKCE: the server needs the verifier matching the earlier hash. The attacker never had it. Rejected.", blocked: true }
      : { from: "auth", to: "attacker", msg: "access_token for the user's account", text: "Without PKCE the code alone is enough. The attacker now has access to the user's orders.", bad: true },
  ];
}
