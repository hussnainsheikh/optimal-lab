// A payment provider sends webhooks to your endpoint.
export type Scenario = "normal" | "down" | "timeout" | "forged";
export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "normal", label: "Normal delivery" },
  { id: "down", label: "Your endpoint is down" },
  { id: "timeout", label: "Slow response, retried" },
  { id: "forged", label: "Someone forges a call" },
];
export type Ev = { t: string; who: "provider" | "you" | "attacker"; text: string; kind: "ok" | "bad" | "info" | "dup" };
export function run(s: Scenario, verify: boolean, dedupe: boolean): { log: Ev[]; credits: number } {
  const log: Ev[] = [];
  let credits = 0;
  const handle = (t: string, signed: boolean, who: Ev["who"] = "provider") => {
    if (verify && !signed) { log.push({ t, who: "you", text: "HMAC signature doesn't match: 401, ignored.", kind: "ok" }); return; }
    if (dedupe && credits > 0) { log.push({ t, who: "you", text: "evt_123 already processed: 200, no-op.", kind: "ok" }); return; }
    credits++;
    log.push({ t, who: "you", text: credits > 1 ? "Credit the order AGAIN" : who === "attacker" ? "Order marked paid, but nobody paid" : "Verify, credit the order, reply 200", kind: credits > 1 || who === "attacker" ? "bad" : "ok" });
  };
  if (s === "forged") {
    log.push({ t: "0s", who: "attacker", text: 'POST /webhooks {"type":"payment.succeeded"} (no valid signature)', kind: "info" });
    handle("0s", false, "attacker");
    return { log, credits };
  }
  log.push({ t: "0s", who: "provider", text: "POST evt_123 payment.succeeded (signed)", kind: "info" });
  if (s === "down") {
    log.push({ t: "0s", who: "provider", text: "503 / connection refused. Will retry.", kind: "info" });
    log.push({ t: "1m", who: "provider", text: "retry 1: 503", kind: "info" }, { t: "5m", who: "provider", text: "retry 2: 503", kind: "info" });
    log.push({ t: "30m", who: "provider", text: "retry 3: delivered", kind: "info" });
    handle("30m", true);
  } else if (s === "timeout") {
    handle("0s", true);
    log.push({ t: "10s", who: "provider", text: "No 200 within 10 s (you were slow), so it counts as failed and retries.", kind: "info" });
    log.push({ t: "1m", who: "provider", text: "retry 1: POST evt_123 again", kind: "info" });
    handle("1m", true);
  } else handle("0s", true);
  return { log, credits };
}
