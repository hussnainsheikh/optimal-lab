// Four ways to get chat messages to a browser over one minute. Messages arrive at these seconds:
export const MSGS = [3, 4, 19, 42];
export type T = "poll" | "long" | "sse" | "ws";
export const TRANSPORTS: { id: T; label: string }[] = [
  { id: "poll", label: "Polling every 10 s" },
  { id: "long", label: "Long polling" },
  { id: "sse", label: "Server-Sent Events" },
  { id: "ws", label: "WebSocket" },
];
export function run(t: T) {
  if (t === "poll") {
    const delays = MSGS.map((m) => Math.ceil(m / 10) * 10 - m);
    return { delays, requests: 6, connections: "new request each poll", twoWay: "separate POSTs", note: "Simple and cache-friendly, but messages wait up to 10 s, and 6 requests a minute per user mostly return nothing." };
  }
  if (t === "long") return { delays: MSGS.map(() => 0.1), requests: MSGS.length + 1, connections: "1 held, re-opened after each message", twoWay: "separate POSTs", note: "The server holds the request open until there's news. Near-instant, works everywhere, but every message costs a new request." };
  if (t === "sse") return { delays: MSGS.map(() => 0.05), requests: 1, connections: "1 long-lived HTTP stream", twoWay: "server → client only", note: "One HTTP response that never ends; the server writes events into it. Auto-reconnects. Great for feeds and AI token streams." };
  return { delays: MSGS.map(() => 0.05), requests: 1, connections: "1 upgraded TCP connection", twoWay: "both directions", note: "Full duplex: either side sends any time. Best for chat, games and collaboration, but needs sticky connections and its own scaling." };
}
