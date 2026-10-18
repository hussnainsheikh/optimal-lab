// REST, GraphQL, gRPC and WebSockets on the same three jobs: what goes over the
// wire, how many round trips it takes, and how much of it the screen needed.
// JSON sizes are measured from real sample objects; protobuf sizes are estimated
// from the wire format (tag + varint or length-prefixed bytes).

export type StyleId = "rest" | "graphql" | "grpc" | "ws";
export type ScenarioId = "profile" | "live" | "batch";
export type Verdict = "good" | "ok" | "bad";

export const STYLES: { id: StyleId; label: string; one: string }[] = [
  { id: "rest", label: "REST", one: "Resources at URLs, fetched whole with HTTP verbs." },
  { id: "graphql", label: "GraphQL", one: "One query names exactly the fields the screen wants." },
  { id: "grpc", label: "gRPC", one: "Typed procedure calls with protobuf messages over HTTP/2." },
  { id: "ws", label: "WebSockets", one: "One open connection; either side sends at any time." },
];

export const SCENARIOS: { id: ScenarioId; label: string; text: string; rttMs: number; mbps: number }[] = [
  { id: "profile", label: "Profile screen", text: "A phone shows a user's name and avatar, their last 3 orders (total, date) and each order's items (name, quantity).", rttMs: 50, mbps: 10 },
  { id: "live", label: "Live location", text: "A courier's position changes once a second for a minute; the customer's phone follows it.", rttMs: 50, mbps: 10 },
  { id: "batch", label: "Service to service", text: "The pricing service asks the catalog service for the price and stock of 1,000 products, once a minute, inside the data centre.", rttMs: 1, mbps: 1000 },
];

// Sample records, as a typical API stores them. Sizes below are measured from these.
export const USER = {
  id: 42, name: "Sara Ahmed", email: "sara@example.com", avatar_url: "https://cdn.example.com/u/42.jpg",
  created_at: "2021-03-04T10:22:00Z", locale: "en-GB", timezone: "Europe/London", phone: "+44 7700 900123",
  marketing_opt_in: false, address: { line1: "12 Elm Street", city: "Leeds", postcode: "LS1 4AB", country: "GB" },
  tier: "gold", last_login_at: "2026-10-18T07:31:00Z",
};
export const ORDER = {
  id: 9001, user_id: 42, status: "delivered", total: 48.5, currency: "GBP", placed_at: "2026-10-01T09:12:00Z",
  shipped_at: "2026-10-02T15:40:00Z", delivered_at: "2026-10-04T11:05:00Z",
  shipping_address: { line1: "12 Elm Street", city: "Leeds", postcode: "LS1 4AB", country: "GB" },
  payment_method: "visa_4242", note: "",
};
export const ITEM = { id: 1, order_id: 9001, product_id: 77, name: "Desk lamp", qty: 1, unit_price: 32, sku: "LAMP-01", image_url: "https://cdn.example.com/p/77.jpg" };
export const POSITION = { lat: 53.8008, lng: -1.5491, heading: 240, at: "2026-10-18T07:31:00Z" };
export const PRODUCT = {
  id: 77, sku: "LAMP-01", name: "Desk lamp", description: "A warm, dimmable lamp for a desk or bedside table.", price: 32, currency: "GBP",
  stock: 14, category: "lighting", image_url: "https://cdn.example.com/p/77.jpg", weight_g: 850, created_at: "2024-05-01T00:00:00Z", updated_at: "2026-10-18T06:00:00Z",
};

// What each screen really needs.
const USER_NEED = { name: USER.name, avatar_url: USER.avatar_url };
const ORDER_NEED = { id: ORDER.id, total: ORDER.total, placed_at: ORDER.placed_at };
const ITEM_NEED = { name: ITEM.name, qty: ITEM.qty };
const PRODUCT_NEED = { id: PRODUCT.id, price: PRODUCT.price, stock: PRODUCT.stock };

export const ORDERS = 3;
export const ITEMS_PER_ORDER = 2;
export const UPDATES = 60;
export const PRODUCTS = 1000;

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export function jsonBytes(v: Json): number {
  return JSON.stringify(v).length; // the samples are ASCII, so chars = bytes
}

export function fields(v: Json): number {
  if (Array.isArray(v)) return v.reduce<number>((s, x) => s + fields(x), 0);
  if (v && typeof v === "object") return Object.values(v).reduce<number>((s, x) => s + fields(x), 0);
  return 1;
}

const DATE = /^\d{4}-\d{2}-\d{2}T/;
function varint(n: number): number {
  let b = 1;
  while (n >= 128) {
    n = Math.floor(n / 128);
    b++;
  }
  return b;
}
// Protobuf wire size: 1-byte tag per field; strings and messages are length-prefixed;
// integers are varints; non-integers are 8-byte doubles; ISO dates become int64 seconds.
export function protoBytes(v: Json): number {
  if (Array.isArray(v)) return v.reduce<number>((s, x) => s + protoBytes(x), 0);
  if (v && typeof v === "object") return Object.values(v).reduce<number>((s, x) => s + protoBytes(x), 0);
  if (typeof v === "string") return DATE.test(v) ? 1 + 5 : 2 + v.length;
  if (typeof v === "number") return Number.isInteger(v) && v >= 0 ? 1 + varint(v) : 9;
  if (typeof v === "boolean") return 2;
  return 0;
}
function protoMessage(v: Json): number {
  return 2 + protoBytes(v);
}

export type Msg = { dir: "up" | "down"; label: string; bytes: number; count: number; wait?: boolean };

export type Result = {
  requests: number;
  rounds: number; // sequential round trips before the screen has its first data
  sent: number;
  received: number;
  fieldsNeeded: number;
  fieldsReceived: number;
  latencyMs: number; // rounds × RTT + bytes at the link speed
  delayMs?: number; // live only: average time from a change to the phone showing it
  verdict: Verdict;
  why: string;
  exchange: Msg[];
};

const GQL_PROFILE_QUERY = "{ user(id: 42) { name avatarUrl orders(last: 3) { id total placedAt items { name qty } } } }";
const GQL_LIVE_SUB = "subscription { courier(id: 7) { lat lng heading at } }";
const GQL_BATCH_QUERY = "{ products(ids: [...1000 ids]) { id price stock } }";
export const WS_UPGRADE = 180; // bytes: the HTTP upgrade request, roughly
export const WS_FRAME = 4; // bytes of frame header on a small client→server message (2 + 4-byte mask), 2 server→client

function finish(sc: ScenarioId, r: Omit<Result, "latencyMs" | "sent" | "received">): Result {
  const s = SCENARIOS.find((x) => x.id === sc)!;
  const sent = r.exchange.filter((m) => m.dir === "up").reduce((a, m) => a + m.bytes * m.count, 0);
  const received = r.exchange.filter((m) => m.dir === "down").reduce((a, m) => a + m.bytes * m.count, 0);
  const latencyMs = r.rounds * s.rttMs + ((sent + received) * 8) / (s.mbps * 1000);
  return { ...r, sent, received, latencyMs };
}

export function run(style: StyleId, sc: ScenarioId): Result {
  if (sc === "profile") {
    const needed = fields(USER_NEED) + ORDERS * (fields(ORDER_NEED) + ITEMS_PER_ORDER * fields(ITEM_NEED));
    const needJson = jsonBytes({ user: { ...USER_NEED, orders: Array(ORDERS).fill({ ...ORDER_NEED, items: Array(ITEMS_PER_ORDER).fill(ITEM_NEED) }) } });
    if (style === "rest")
      return finish(sc, {
        requests: 2 + ORDERS,
        rounds: 2,
        fieldsNeeded: needed,
        fieldsReceived: fields(USER) + ORDERS * (fields(ORDER) + ITEMS_PER_ORDER * fields(ITEM)),
        verdict: "ok",
        why: `${2 + ORDERS} requests in 2 rounds, and ${fields(USER) + ORDERS * (fields(ORDER) + ITEMS_PER_ORDER * fields(ITEM))} fields for the ${needed} the screen shows. Cacheable by URL, and every HTTP tool understands it.`,
        exchange: [
          { dir: "up", label: "GET /users/42", bytes: 24, count: 1 },
          { dir: "up", label: "GET /users/42/orders?limit=3", bytes: 38, count: 1 },
          { dir: "down", label: "user (every field)", bytes: jsonBytes(USER), count: 1 },
          { dir: "down", label: "3 orders (every field)", bytes: jsonBytes(Array(ORDERS).fill(ORDER)), count: 1 },
          { dir: "up", label: "GET /orders/:id/items ×3", bytes: 30, count: ORDERS, wait: true },
          { dir: "down", label: "items (every field) ×3", bytes: jsonBytes(Array(ITEMS_PER_ORDER).fill(ITEM)), count: ORDERS },
        ],
      });
    if (style === "graphql")
      return finish(sc, {
        requests: 1,
        rounds: 1,
        fieldsNeeded: needed,
        fieldsReceived: needed,
        verdict: "good",
        why: `One query, one round trip, exactly the ${needed} fields. The server still runs the joins, and a POST isn't cached by URL.`,
        exchange: [
          { dir: "up", label: "POST /graphql (the query)", bytes: GQL_PROFILE_QUERY.length + 12, count: 1 },
          { dir: "down", label: "exactly the fields asked for", bytes: needJson, count: 1 },
        ],
      });
    if (style === "grpc") {
      const proto = protoMessage({ ...USER_NEED, orders: Array(ORDERS).fill({ ...ORDER_NEED, items: Array(ITEMS_PER_ORDER).fill(ITEM_NEED) }) });
      return finish(sc, {
        requests: 1,
        rounds: 1,
        fieldsNeeded: needed,
        fieldsReceived: needed,
        verdict: "ok",
        why: `One GetProfile call and about ${proto} bytes back, if someone defined an RPC shaped for this screen. A browser needs grpc-web and a proxy to call it at all.`,
        exchange: [
          { dir: "up", label: "GetProfile(user_id: 42)", bytes: protoMessage({ user_id: 42 }), count: 1 },
          { dir: "down", label: "Profile message (protobuf)", bytes: proto, count: 1 },
        ],
      });
    }
    return finish(sc, {
      requests: 2,
      rounds: 2,
      fieldsNeeded: needed,
      fieldsReceived: needed,
      verdict: "bad",
      why: "Nothing here changes while you look at it. Opening a socket costs a round trip and a server slot, and you still have to invent a request/response format on top.",
      exchange: [
        { dir: "up", label: "HTTP upgrade", bytes: WS_UPGRADE, count: 1 },
        { dir: "down", label: "101 Switching Protocols", bytes: 130, count: 1 },
        { dir: "up", label: '{"get":"profile","id":42}', bytes: 26 + WS_FRAME, count: 1, wait: true },
        { dir: "down", label: "profile (your own format)", bytes: needJson + 2, count: 1 },
      ],
    });
  }

  if (sc === "live") {
    const needed = fields(POSITION) * UPDATES;
    const pos = jsonBytes(POSITION);
    const s = SCENARIOS[1];
    if (style === "rest")
      return finish(sc, {
        requests: UPDATES,
        rounds: 1,
        fieldsNeeded: needed,
        fieldsReceived: needed,
        delayMs: 500 + s.rttMs,
        verdict: "bad",
        why: `Polling once a second: ${UPDATES} requests a minute per customer, and a position is on average ${Math.round((500 + s.rttMs) / 10) / 100} s old when it's shown. Poll faster and the requests multiply.`,
        exchange: [
          { dir: "up", label: "GET /couriers/7/position ×60", bytes: 32, count: UPDATES },
          { dir: "down", label: "position ×60", bytes: pos, count: UPDATES },
        ],
      });
    if (style === "graphql")
      return finish(sc, {
        requests: 2,
        rounds: 2,
        fieldsNeeded: needed,
        fieldsReceived: needed,
        delayMs: s.rttMs / 2,
        verdict: "ok",
        why: "A subscription is GraphQL's push: it opens a WebSocket underneath and the server sends each change. You get the schema and the field selection; you also run a WebSocket server.",
        exchange: [
          { dir: "up", label: "HTTP upgrade", bytes: WS_UPGRADE, count: 1 },
          { dir: "down", label: "101 Switching Protocols", bytes: 130, count: 1 },
          { dir: "up", label: "subscribe", bytes: GQL_LIVE_SUB.length + 30 + WS_FRAME, count: 1, wait: true },
          { dir: "down", label: "pushed position ×60", bytes: jsonBytes({ data: { courier: POSITION } }) + 2, count: UPDATES },
        ],
      });
    if (style === "grpc")
      return finish(sc, {
        requests: 1,
        rounds: 1,
        fieldsNeeded: needed,
        fieldsReceived: needed,
        delayMs: s.rttMs / 2,
        verdict: "good",
        why: `Server streaming is built in: one call, ${UPDATES} small protobuf messages, half a round trip of delay. Between services it's the natural fit; a phone app can use it directly, a browser can't without a proxy.`,
        exchange: [
          { dir: "up", label: "WatchCourier(id: 7)", bytes: protoMessage({ id: 7 }), count: 1 },
          { dir: "down", label: "Position message ×60", bytes: protoMessage(POSITION), count: UPDATES },
        ],
      });
    return finish(sc, {
      requests: 1,
      rounds: 1,
      fieldsNeeded: needed,
      fieldsReceived: needed,
      delayMs: s.rttMs / 2,
      verdict: "good",
      why: `One connection, ${UPDATES} frames of a few bytes of header each, half a round trip of delay, and the customer can send too. Every browser speaks it. At scale each open socket is a server slot to keep.`,
      exchange: [
        { dir: "up", label: "HTTP upgrade", bytes: WS_UPGRADE, count: 1 },
        { dir: "down", label: "101 Switching Protocols", bytes: 130, count: 1 },
        { dir: "down", label: "position frame ×60", bytes: pos + 2, count: UPDATES },
      ],
    });
  }

  // batch: 1,000 products, service to service
  const needed = fields(PRODUCT_NEED) * PRODUCTS;
  const PAGE = 100;
  if (style === "rest")
    return finish(sc, {
      requests: PRODUCTS / PAGE,
      rounds: 1,
      fieldsNeeded: needed,
      fieldsReceived: fields(PRODUCT) * PRODUCTS,
      verdict: "bad",
      why: `${PRODUCTS / PAGE} pages of full product records: ${Math.round((jsonBytes(Array(PAGE).fill(PRODUCT)) * (PRODUCTS / PAGE)) / 1024)} KB for the ${Math.round((jsonBytes(Array(PRODUCTS).fill(PRODUCT_NEED)) / 1024) * 10) / 10} KB of fields anyone wanted. Fine once; once a minute from ten services it's the catalog's whole bandwidth.`,
      exchange: [
        { dir: "up", label: "GET /products?page=n ×10", bytes: 40, count: PRODUCTS / PAGE },
        { dir: "down", label: "100 products (every field) ×10", bytes: jsonBytes(Array(PAGE).fill(PRODUCT)), count: PRODUCTS / PAGE },
      ],
    });
  if (style === "graphql")
    return finish(sc, {
      requests: 1,
      rounds: 1,
      fieldsNeeded: needed,
      fieldsReceived: needed,
      verdict: "ok",
      why: "One query, three fields each. Works, but between two services you already control both ends: the schema layer, the resolvers and the JSON are overhead you don't need.",
      exchange: [
        { dir: "up", label: "POST /graphql (1,000 ids)", bytes: GQL_BATCH_QUERY.length + PRODUCTS * 5, count: 1 },
        { dir: "down", label: "1,000 × { id price stock }", bytes: jsonBytes(Array(PRODUCTS).fill(PRODUCT_NEED)), count: 1 },
      ],
    });
  if (style === "grpc")
    return finish(sc, {
      requests: 1,
      rounds: 1,
      fieldsNeeded: needed,
      fieldsReceived: needed,
      verdict: "good",
      why: `One GetPrices call; about ${Math.round(((protoMessage({ id: 77, price: 32, stock: 14 }) + 1) * PRODUCTS) / 1024)} KB of protobuf, a generated client with types on both sides, and HTTP/2 multiplexing for free. This is what it was built for.`,
      exchange: [
        { dir: "up", label: "GetPrices(ids: [1,000])", bytes: PRODUCTS * 3, count: 1 },
        { dir: "down", label: "1,000 Price messages", bytes: (protoMessage({ id: 77, price: 32, stock: 14 }) + 1) * PRODUCTS, count: 1 },
      ],
    });
  return finish(sc, {
    requests: 1,
    rounds: 1,
    fieldsNeeded: needed,
    fieldsReceived: needed,
    verdict: "bad",
    why: "A request and a reply over an already-open socket: it works, but you've written your own RPC with no types, no load balancing per call and no tooling. Use it for pushes, not for this.",
    exchange: [
      { dir: "up", label: '{"get":"prices","ids":[…]}', bytes: 26 + PRODUCTS * 5 + WS_FRAME, count: 1 },
      { dir: "down", label: "1,000 × { id price stock } (your format)", bytes: jsonBytes(Array(PRODUCTS).fill(PRODUCT_NEED)) + 2, count: 1 },
    ],
  });
}

export function kb(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 100) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function ms(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v < 10 ? v.toFixed(1) : Math.round(v)} ms`;
}
