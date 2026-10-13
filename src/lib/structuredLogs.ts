// The same three events as free text and as structured JSON, and a question to answer from them.
export const PLAIN = [
  "2026-10-13 14:02:11 INFO checkout started for user 42 cart=3 items",
  "2026-10-13 14:02:12 INFO payment ok user=17 amount 25.00",
  "2026-10-13 14:02:12 ERROR Payment failed for customer #42: card declined (req a91f)",
  "2026-10-13 14:02:13 WARN retrying payment, uid 42",
  "2026-10-13 14:02:14 ERROR checkout: payment declined user_id: 42",
];
export const JSONL = [
  { ts: "14:02:11", level: "info", service: "checkout", msg: "checkout started", user_id: 42, request_id: "a91f", items: 3 },
  { ts: "14:02:12", level: "info", service: "payments", msg: "payment succeeded", user_id: 17, request_id: "77c2", amount: 25 },
  { ts: "14:02:12", level: "error", service: "payments", msg: "payment failed", user_id: 42, request_id: "a91f", reason: "card_declined" },
  { ts: "14:02:13", level: "warn", service: "payments", msg: "retrying payment", user_id: 42, request_id: "a91f", attempt: 2 },
  { ts: "14:02:14", level: "error", service: "checkout", msg: "checkout failed", user_id: 42, request_id: "a91f", reason: "card_declined" },
];
export const GREP = 'grep "ERROR" app.log | grep "user 42"';
export const plainHits = () => PLAIN.map((l, i) => (l.includes("ERROR") && l.includes("user 42") ? i : -1)).filter((i) => i >= 0);
export const QUERY = 'level = "error" AND user_id = 42';
export const jsonHits = () => JSONL.map((l, i) => (l.level === "error" && l.user_id === 42 ? i : -1)).filter((i) => i >= 0);
