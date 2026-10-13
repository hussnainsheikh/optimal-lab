// Bundle sizes (KB, compressed) for an app with three routes and one heavy chart library.
export const MODULES = [
  { name: "react + router", kb: 55, route: "shared" },
  { name: "design system", kb: 30, route: "shared" },
  { name: "home page", kb: 20, route: "home" },
  { name: "settings page", kb: 35, route: "settings" },
  { name: "dashboard page", kb: 25, route: "dashboard" },
  { name: "chart library", kb: 180, route: "chart" },
  { name: "markdown editor", kb: 120, route: "settings-editor" },
];
export type Strategy = "single" | "routes" | "lazy";
export const STRATEGIES: { id: Strategy; label: string }[] = [
  { id: "single", label: "One big bundle" },
  { id: "routes", label: "Split by route" },
  { id: "lazy", label: "Routes + lazy heavy parts" },
];
export function chunkOf(s: Strategy, route: string) {
  if (s === "single") return "main";
  if (route === "shared") return "main";
  if (s === "routes") return route === "chart" ? "dashboard" : route === "settings-editor" ? "settings" : route;
  return route;
}
export function firstLoad(s: Strategy, page: "home" | "dashboard") {
  const need = new Set(["main", page]);
  const kb = MODULES.filter((m) => need.has(chunkOf(s, m.route))).reduce((a, m) => a + m.kb, 0);
  return { kb, ms: Math.round((kb / 200) * 1000) }; // ~200 KB/s on slow 4G
}
