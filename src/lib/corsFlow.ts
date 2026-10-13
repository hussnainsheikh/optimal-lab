// app.example.com calls api.partner.com from the browser.
export type Case = "nocors" | "allowed" | "preflight-ok" | "preflight-no" | "creds-star";
export const CASES: { id: Case; label: string }[] = [
  { id: "nocors", label: "GET, API sends no CORS headers" },
  { id: "allowed", label: "GET, API allows app.example.com" },
  { id: "preflight-ok", label: "POST JSON, preflight allowed" },
  { id: "preflight-no", label: "POST JSON, preflight not handled" },
  { id: "creds-star", label: "With cookies, API answers *" },
];
export function flow(c: Case) {
  const steps: { from: string; to: string; msg: string; bad?: boolean }[] = [];
  const pre = c === "preflight-ok" || c === "preflight-no";
  if (pre) {
    steps.push({ from: "browser", to: "api", msg: "OPTIONS /orders  Origin: https://app.example.com  Access-Control-Request-Method: POST  Access-Control-Request-Headers: content-type" });
    if (c === "preflight-no") { steps.push({ from: "api", to: "browser", msg: "405 Method Not Allowed (no CORS headers)", bad: true }); return { steps, ok: false, sent: false, note: "JSON POSTs aren't “simple”, so the browser asks permission first. The API doesn't answer the preflight, so the real request is never sent." }; }
    steps.push({ from: "api", to: "browser", msg: "204  Access-Control-Allow-Origin: https://app.example.com  Allow-Methods: POST  Allow-Headers: content-type" });
  }
  steps.push({ from: "browser", to: "api", msg: `${pre ? "POST" : "GET"} /orders  Origin: https://app.example.com${c === "creds-star" ? "  Cookie: session=…" : ""}` });
  if (c === "nocors") { steps.push({ from: "api", to: "browser", msg: "200 OK  [data]  (no Access-Control-Allow-Origin)", bad: true }); return { steps, ok: false, sent: true, note: "The request reached the server and it answered, but the browser refuses to hand the response to your JavaScript. CORS limits reading, not sending." }; }
  if (c === "creds-star") { steps.push({ from: "api", to: "browser", msg: "200 OK  Access-Control-Allow-Origin: *", bad: true }); return { steps, ok: false, sent: true, note: "With credentials, the wildcard isn't allowed: the server must echo the exact origin and add Access-Control-Allow-Credentials: true." }; }
  steps.push({ from: "api", to: "browser", msg: "200 OK  Access-Control-Allow-Origin: https://app.example.com" });
  return { steps, ok: true, sent: true, note: pre ? "Preflight approved, real request sent, response readable." : "The API opts in for this origin, so the browser lets your code read the response." };
}
