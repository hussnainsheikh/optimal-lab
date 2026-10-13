// Resources with their Cache-Control headers, across four visits.
export const RES = [
  { name: "index.html", header: "no-cache, ETag: \"v41\"", kind: "revalidate" },
  { name: "app.3f9a1c.js", header: "public, max-age=31536000, immutable", kind: "immutable" },
  { name: "logo.png", header: "public, max-age=3600", kind: "hour" },
  { name: "/api/cart", header: "private, no-store", kind: "nostore" },
] as const;
export const VISITS = ["First visit", "Back after 10 minutes", "Back after 2 hours", "After you deploy a new version"];
export function result(kind: (typeof RES)[number]["kind"], v: number) {
  if (kind === "nostore") return { how: "network", note: "Never stored: always fetched fresh." };
  if (v === 0) return { how: "network", note: "Downloaded and stored." };
  if (kind === "immutable") return v === 3 ? { how: "network", note: "New build, new filename (app.8b2e.js): downloaded once." } : { how: "cache", note: "Served from disk. No request at all." };
  if (kind === "revalidate") return v === 3 ? { how: "network", note: "ETag changed: 200 with the new HTML, which points at the new JS." } : { how: "304", note: "Asks “still v41?” and gets 304 Not Modified: tiny response." };
  return v === 1 ? { how: "cache", note: "Within the hour: from cache." } : { how: "network", note: "Older than an hour: fetched again." };
}
