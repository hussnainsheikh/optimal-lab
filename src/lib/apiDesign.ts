// A public API for orders. Paginate a list that changes while the client reads it,
// see what deep pages cost the database, change a field without breaking old apps,
// and return errors a client can act on. Pagination is simulated row by row.

export const PAGE = 10;
export const START_ITEMS = 100;
export const INSERTS_PER_PAGE = 3; // new orders arrive while the client reads
export const PAGES_READ = 5;

export type Paging = "offset" | "cursor";
export type Change = "inserts" | "deletes";

export type PageView = { page: number; ids: number[]; dupes: number[]; skipped: number[] };
export type PagingRun = { pages: PageView[]; seen: number; dupes: number; skipped: number };

// Newest first. Offset reads positions [p·PAGE, p·PAGE+PAGE) of the list as it is now;
// a cursor reads the next PAGE ids smaller than the last one returned.
export function paginate(mode: Paging, change: Change): PagingRun {
  let list = Array.from({ length: START_ITEMS }, (_, i) => START_ITEMS - i); // 100…1
  let nextId = START_ITEMS + 1;
  const seen = new Set<number>();
  const missed = new Set<number>();
  const pages: PageView[] = [];
  let cursor = Infinity;
  let dupes = 0;
  let skipped = 0;
  for (let p = 0; p < PAGES_READ; p++) {
    const ids = mode === "offset" ? list.slice(p * PAGE, p * PAGE + PAGE) : list.filter((id) => id < cursor).slice(0, PAGE);
    const d = ids.filter((id) => seen.has(id));
    // skipped: ids that, in the original order, fall between what we've read and what this page starts at, never returned
    const lowest = Math.min(...ids);
    const missing = list.filter((id) => id > lowest && id <= START_ITEMS && !seen.has(id) && !ids.includes(id) && !missed.has(id));
    missing.forEach((id) => missed.add(id));
    ids.forEach((id) => seen.add(id));
    dupes += d.length;
    skipped += missing.length;
    pages.push({ page: p + 1, ids, dupes: d, skipped: missing });
    cursor = lowest;
    // the world changes before the next request
    if (change === "inserts") {
      const fresh = Array.from({ length: INSERTS_PER_PAGE }, () => nextId++).reverse();
      list = [...fresh, ...list];
    } else {
      // two orders the client has already read are deleted
      const victims = list.filter((id) => seen.has(id)).slice(0, 2);
      list = list.filter((id) => !victims.includes(id));
    }
  }
  return { pages, seen: seen.size, dupes, skipped };
}

export const TABLE_ROWS = 10_000_000;
export const DEEP_PAGES = [1, 100, 10_000];
// Rows the database touches: OFFSET n LIMIT k walks n + k index entries; WHERE id < cursor LIMIT k seeks and reads k.
export const rowsTouched = (mode: Paging, page: number) => (mode === "offset" ? (page - 1) * PAGE + PAGE : PAGE);
export const MS_PER_ROW = 0.0005; // half a microsecond an index entry, a fast in-memory B-tree walk
export const msFor = (rows: number) => 1 + rows * MS_PER_ROW;

// Versioning: 30% of mobile users never update the app.
export type Evolution = "inPlace" | "versioned" | "additive";
export const EVOLUTIONS: { id: Evolution; label: string; one: string }[] = [
  { id: "inPlace", label: "Change it in place", one: "Rename total to amount in the existing response." },
  { id: "versioned", label: "New version", one: "Ship /v2 with amount; keep /v1 with total running until old apps are gone." },
  { id: "additive", label: "Add, deprecate, remove later", one: "Return both total and amount; mark total deprecated with a Sunset date; remove when traffic to it reaches zero." },
];
export const OLD_APP_SHARE = 0.3;
export const DAILY_USERS = 200_000;
export const evolve = (e: Evolution) => ({
  brokenUsers: e === "inPlace" ? Math.round(DAILY_USERS * OLD_APP_SHARE) : 0,
  versionsToRun: e === "versioned" ? 2 : 1,
  bytesExtra: e === "additive" ? 14 : 0, // ,"total":48.5 per order while both exist
});

// Errors: how much a client can do with each response.
export type ErrorStyle = "plain" | "generic" | "problem";
export const ERROR_STYLES: { id: ErrorStyle; label: string; status: number; body: string }[] = [
  { id: "plain", label: "500 with a message", status: 500, body: "Something went wrong" },
  { id: "generic", label: "400 with an error string", status: 400, body: '{ "error": "invalid request" }' },
  {
    id: "problem",
    label: "422 Problem Details",
    status: 422,
    body: '{\n  "type": "https://api.shop.example/errors/validation",\n  "title": "Order is invalid",\n  "status": 422,\n  "errors": [\n    { "pointer": "/items/0/qty", "detail": "must be at least 1" },\n    { "pointer": "/postcode", "detail": "not a UK postcode" }\n  ]\n}',
  },
];
export const ERROR_CHECKS: { label: string; pass: Record<ErrorStyle, boolean> }[] = [
  { label: "Client knows it was its fault, not the server's (4xx vs 5xx)", pass: { plain: false, generic: true, problem: true } },
  { label: "Client knows not to retry the same request", pass: { plain: false, generic: true, problem: true } },
  { label: "A machine-readable error type to branch on", pass: { plain: false, generic: false, problem: true } },
  { label: "The form can highlight which field is wrong", pass: { plain: false, generic: false, problem: true } },
  { label: "Every error in one response, not one per attempt", pass: { plain: false, generic: false, problem: true } },
];

export const ENDPOINTS: { method: string; path: string; does: string; safe: boolean; idempotent: boolean }[] = [
  { method: "GET", path: "/orders?status=open&limit=10", does: "list, filtered", safe: true, idempotent: true },
  { method: "GET", path: "/orders/9001", does: "one order", safe: true, idempotent: true },
  { method: "POST", path: "/orders", does: "create (send an Idempotency-Key)", safe: false, idempotent: false },
  { method: "PATCH", path: "/orders/9001", does: "change some fields", safe: false, idempotent: false },
  { method: "PUT", path: "/orders/9001/address", does: "replace the address", safe: false, idempotent: true },
  { method: "DELETE", path: "/orders/9001", does: "cancel", safe: false, idempotent: true },
];
