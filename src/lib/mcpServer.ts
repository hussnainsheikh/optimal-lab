// Three versions of the same MCP tool, and what a model does with each for three user requests.
export type Version = "vague" | "clear" | "clear-lean";
export const VERSIONS: { id: Version; label: string }[] = [
  { id: "vague", label: "Vague tool" },
  { id: "clear", label: "Clear name, schema, description" },
  { id: "clear-lean", label: "…and lean results" },
];
export const DEFS: Record<Version, string> = {
  vague: `{
  name: "query",
  description: "Query data",
  inputSchema: { type: "object",
    properties: { q: { type: "string" } } }
}`,
  clear: `{
  name: "search_orders",
  description: "Find a customer's orders. Use for order
    status or history. Dates are YYYY-MM-DD.",
  inputSchema: { type: "object",
    properties: {
      email: { type: "string", format: "email" },
      status: { enum: ["pending", "shipped", "refunded"] },
      since: { type: "string", format: "date" } },
    required: ["email"] }
}`,
  "clear-lean": `same definition, but results return
  { id, status, total, date } per order
  (max 10) instead of full raw records`,
};
export const REQUESTS = ["Where is my order? I'm ada@example.com", "Show refunded orders for bo@example.com since March", "What's the weather in Paris?"];
export function outcome(v: Version, i: number) {
  if (i === 2) return v === "vague" ? { call: 'query({ q: "weather in Paris" })', ok: false, note: "“Query data” could mean anything, so the model tries it for the weather. The tool returns junk." } : { call: "(no tool call)", ok: true, note: "The description says orders only, so the model doesn't use it for weather." };
  if (v === "vague") return i === 0 ? { call: 'query({ q: "order ada" })', ok: false, note: "The model has to guess a query language. Your server can't parse it reliably." } : { call: 'query({ q: "refunded bo march" })', ok: false, note: "No fields for status or date, so the filter is lost." };
  const call = i === 0 ? 'search_orders({ email: "ada@example.com" })' : 'search_orders({ email: "bo@example.com", status: "refunded", since: "2026-03-01" })';
  return v === "clear" ? { call, ok: true, note: "Correct call, but the server returns 40 full order records: ~9,000 tokens into the context for a one-line answer." } : { call, ok: true, note: "Correct call and a compact result: ~300 tokens. Faster, cheaper, and the model reads it accurately." };
}
export const TOKENS: Record<Version, number> = { vague: 2500, clear: 9000, "clear-lean": 300 };
