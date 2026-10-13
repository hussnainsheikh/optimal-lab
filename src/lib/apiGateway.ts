// Requests passing through an API gateway's stages.
export const STAGES = ["TLS", "Auth", "Rate limit", "Cache", "Route", "Service"];
export const REQUESTS = [
  { label: "GET /products (valid token)", stop: null as number | null, status: 200, note: "Passes every check; cache miss, routed to the catalog service." },
  { label: "GET /products (same, again)", stop: 3, status: 200, note: "Same request within the cache TTL: answered by the gateway without touching the service." },
  { label: "POST /orders (no token)", stop: 1, status: 401, note: "Rejected at auth. The order service never sees unauthenticated traffic." },
  { label: "GET /search (101st call this minute)", stop: 2, status: 429, note: "Over the client's quota: 429 with a Retry-After header." },
  { label: "GET /admin/users (valid token, wrong scope)", stop: 1, status: 403, note: "Authenticated, but the token lacks the admin scope." },
  { label: "GET /v1/legacy", stop: 4, status: 404, note: "No route matches: the gateway returns 404 itself." },
];
