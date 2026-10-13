// A product page and its dependencies. What happens when one fails?
export const DEPS = [
  { id: "catalog", label: "Product catalog", critical: true, fallback: "none: show an error page" },
  { id: "price", label: "Personalised pricing", critical: false, fallback: "list price" },
  { id: "reviews", label: "Reviews", critical: false, fallback: "cached reviews from an hour ago" },
  { id: "recs", label: "Recommendations", critical: false, fallback: "hide the section" },
  { id: "stock", label: "Live stock count", critical: false, fallback: "“In stock” without a number" },
] as const;
export type DepId = (typeof DEPS)[number]["id"];
export function render(down: Set<DepId>, fallbacks: boolean) {
  if (down.has("catalog")) return { status: 503, sections: [] as { id: DepId; state: "ok" | "fallback" | "hidden" }[], ms: 120 };
  if (!fallbacks && down.size) return { status: 500, sections: [], ms: 30000 };
  return { status: 200, ms: down.size ? 380 : 320, sections: DEPS.filter((d) => d.id !== "catalog").map((d) => ({ id: d.id, state: (down.has(d.id) ? (d.id === "recs" ? "hidden" : "fallback") : "ok") as "ok" | "fallback" | "hidden" })) };
}
