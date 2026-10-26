// A document store in miniature: 2,000 generated orders stored as whole JSON documents, the
// way MongoDB or Firestore would hold them. Queries with dotted paths into nested objects and
// arrays really run, with and without a (multikey) index; renaming a customer touches every
// document that embeds a copy; a product that embeds its reviews grows toward the 16 MB document
// limit; and a $jsonSchema-style validator checks every document. Sizes are JSON bytes, a close
// stand-in for BSON.

export type Item = { sku: string; name: string; qty: number | string; price: number };
export type OrderDoc = { _id: number; customer: { id: number; name: string; city: string; adress?: string; email?: string }; items: Item[]; total?: number; status: string };

const CITIES = ["Berlin", "Lisbon", "Austin", "Leeds", "Lyon", "Osaka", "Toronto", "Pune"];
const FIRST = ["Alice", "Ben", "Chen", "Dara", "Eli", "Fatima", "Gus", "Hana", "Ivan", "Jade"];
const LAST = ["Ng", "Okafor", "Silva", "Meyer", "Kowalski", "Haddad", "Tanaka", "Byrne"];
export const PRODUCTS = Array.from({ length: 40 }, (_, i) => ({ sku: `SKU-${String(i + 1).padStart(3, "0")}`, name: ["Desk lamp", "Notebook", "Mug", "Cable", "Chair", "Backpack", "Pen set", "Monitor arm"][i % 8] + (i >= 8 ? ` ${Math.floor(i / 8) + 1}` : ""), price: 5 + ((i * 37 + 29) % 95) }));
export const LAMP = PRODUCTS[0].sku;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let cache: OrderDoc[] | null = null;
/** 2,000 orders from 300 customers. A few were written by older app versions and are malformed. */
export function orders(): OrderDoc[] {
  if (cache) return cache;
  const r = rng(3);
  const customers = Array.from({ length: 300 }, (_, i) => ({ id: i + 1, name: `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`, city: CITIES[Math.floor(r() * CITIES.length)] }));
  const out: OrderDoc[] = [];
  for (let i = 0; i < 2000; i++) {
    // Customers aren't equally busy: a few order a lot.
    const c = customers[Math.floor(Math.pow(r(), 2) * customers.length)];
    const n = 1 + Math.floor(r() * 4);
    const items: Item[] = [];
    for (let k = 0; k < n; k++) {
      const p = PRODUCTS[Math.floor(Math.pow(r(), 1.6) * PRODUCTS.length)];
      if (items.some((x) => x.sku === p.sku)) continue;
      items.push({ sku: p.sku, name: p.name, qty: 1 + Math.floor(r() * 3), price: p.price });
    }
    const doc: OrderDoc = { _id: 50_001 + i, customer: { ...c }, items, total: items.reduce((a, x) => a + Number(x.qty) * x.price, 0), status: r() < 0.8 ? "delivered" : "shipped" };
    const bug = r();
    if (bug < 0.015) doc.items[0] = { ...doc.items[0], qty: String(doc.items[0].qty) }; // an old client sent strings
    else if (bug < 0.025) delete doc.total;
    else if (bug < 0.032) doc.customer = { id: c.id, name: c.name, city: c.city, adress: "12 Main St" }; // a typo nobody caught
    out.push(doc);
  }
  return (cache = out);
}

// ---- queries ---------------------------------------------------------------------------------

/** Values at a dotted path, walking into arrays the way MongoDB does. */
export function valuesAt(doc: unknown, path: string): unknown[] {
  const [head, ...rest] = path.split(".");
  if (Array.isArray(doc)) return doc.flatMap((d) => valuesAt(d, path));
  if (doc === null || typeof doc !== "object") return [];
  const v = (doc as Record<string, unknown>)[head];
  if (v === undefined) return [];
  if (!rest.length) return Array.isArray(v) ? [...v, v] : [v];
  return valuesAt(v, rest.join("."));
}
export type Cond = unknown | { $gt?: number; $lt?: number; $in?: unknown[] };
export type Filter = Record<string, Cond>;
function test(vals: unknown[], cond: Cond) {
  if (cond && typeof cond === "object" && !Array.isArray(cond)) {
    const c = cond as { $gt?: number; $lt?: number; $in?: unknown[] };
    return vals.some((v) => (c.$gt === undefined || (typeof v === "number" && v > c.$gt)) && (c.$lt === undefined || (typeof v === "number" && v < c.$lt)) && (c.$in === undefined || c.$in.includes(v)));
  }
  return vals.some((v) => v === cond);
}
export const matches = (doc: OrderDoc, f: Filter) => Object.entries(f).every(([path, cond]) => test(valuesAt(doc, path), cond));

export type QueryId = "bySku" | "byCity" | "byCustomer";
export const QUERIES: Record<QueryId, { label: string; filter: Filter; indexPath: string; shell: string }> = {
  bySku: { label: "Orders containing the desk lamp", filter: { "items.sku": LAMP }, indexPath: "items.sku", shell: `db.orders.find({ "items.sku": "${LAMP}" })` },
  byCity: { label: "Big orders from Berlin", filter: { "customer.city": "Berlin", total: { $gt: 150 } }, indexPath: "customer.city", shell: `db.orders.find({ "customer.city": "Berlin", total: { $gt: 150 } })` },
  byCustomer: { label: "One customer's orders", filter: { "customer.id": 7 }, indexPath: "customer.id", shell: `db.orders.find({ "customer.id": 7 })` },
};

/** Run a query. With an index on the first path, only documents whose key matches are examined. */
export function find(q: QueryId, indexed: boolean) {
  const docs = orders();
  const { filter, indexPath } = QUERIES[q];
  const keyCond = filter[indexPath];
  const candidates = indexed ? docs.filter((d) => test(valuesAt(d, indexPath), keyCond)) : docs;
  const result = candidates.filter((d) => matches(d, filter));
  // A multikey index has one entry per array element.
  const indexEntries = indexed ? docs.reduce((a, d) => a + new Set(valuesAt(d, indexPath).filter((v) => !Array.isArray(v))).size, 0) : 0;
  return { examined: candidates.length, returned: result.length, indexEntries, sample: result[0] ?? null };
}

// ---- embed vs reference -----------------------------------------------------------------------

export type Shape = "embed" | "reference";
export function renameCustomer(shape: Shape, customerId = 7) {
  const theirs = orders().filter((d) => d.customer.id === customerId).length;
  return shape === "embed"
    ? { written: theirs, readsPerOrderPage: 1, note: `updateMany rewrites ${theirs} order documents that each hold a copy of the name` }
    : { written: 1, readsPerOrderPage: 2, note: "one customer document changes; every order page now needs a second read ($lookup) for the name" };
}
export const relationalOrderPage = (doc: OrderDoc) => ({ rows: 1 + 1 + doc.items.length * 2, tables: 4 }); // order, customer, items, products

// ---- unbounded arrays -------------------------------------------------------------------------

export const DOC_LIMIT_B = 16 * 1024 * 1024;
const REVIEW = { user: "user_83911", rating: 4, title: "Solid lamp, bright enough for reading", body: "Took five minutes to assemble. The arm holds its position and the light is even across the desk. Wish the cable were longer.", at: "2024-06-01T09:14:00Z", helpful: 12 };
export const REVIEW_B = JSON.stringify(REVIEW).length + 1;
export function productDoc(reviews: number, bucketed: boolean) {
  const base = JSON.stringify({ _id: LAMP, name: "Desk lamp", price: 34, specs: { watts: 8, cable_m: 1.5 }, reviews: [] }).length;
  if (bucketed) {
    // Reviews live in their own documents, 100 per bucket; the product keeps a count and the latest 10.
    const product = base + 10 * REVIEW_B + 20;
    const inBucket = ((Math.max(1, reviews) - 1) % 100) + 1; // the newest review lands in a partly full bucket
    return { bytes: product, docs: 1 + Math.ceil(reviews / 100), writtenPerReview: product + inBucket * REVIEW_B, over: false };
  }
  const bytes = base + reviews * REVIEW_B;
  return { bytes, docs: 1, writtenPerReview: bytes, over: bytes > DOC_LIMIT_B };
}

// ---- schema validation ------------------------------------------------------------------------

export const SCHEMA = `{ $jsonSchema: {
  required: ["customer", "items", "total"],
  properties: {
    customer: { required: ["id", "name", "city"], additionalProperties: false },
    items: { items: { properties: { qty: { bsonType: "int", minimum: 1 } } } },
    total: { bsonType: "number" } } } }`;
export function validate(doc: OrderDoc): string[] {
  const errs: string[] = [];
  if (doc.total === undefined) errs.push("missing required field total");
  for (const k of Object.keys(doc.customer)) if (!["id", "name", "city", "email"].includes(k)) errs.push(`customer has unexpected field "${k}"`);
  doc.items.forEach((it, i) => {
    if (typeof it.qty !== "number" || !Number.isInteger(it.qty) || it.qty < 1) errs.push(`items.${i}.qty is ${JSON.stringify(it.qty)}, not an int ≥ 1`);
  });
  return errs;
}
export function validateAll() {
  const bad = orders()
    .map((d) => ({ id: d._id, errs: validate(d) }))
    .filter((x) => x.errs.length);
  return { bad: bad.length, examples: bad.slice(0, 4) };
}
