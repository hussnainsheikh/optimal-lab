// Requests through an Ingress to Services to Pods.
export type Scenario = "healthy" | "selector" | "notready";
export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "healthy", label: "Everything healthy" },
  { id: "selector", label: "Typo in the api selector" },
  { id: "notready", label: "One api pod not ready" },
];
export const RULES = [
  { host: "shop.example.com", path: "/api", service: "api" },
  { host: "shop.example.com", path: "/", service: "web" },
];
export function cluster(s: Scenario) {
  const services = [
    { name: "api", selector: s === "selector" ? "app=apii" : "app=api", port: 8080 },
    { name: "web", selector: "app=web", port: 3000 },
  ];
  const pods = [
    { name: "api-7f9-a", labels: "app=api", ip: "10.1.0.11", ready: true },
    { name: "api-7f9-b", labels: "app=api", ip: "10.1.0.12", ready: s !== "notready" },
    { name: "api-7f9-c", labels: "app=api", ip: "10.1.0.13", ready: true },
    { name: "web-5c2-a", labels: "app=web", ip: "10.1.0.21", ready: true },
    { name: "web-5c2-b", labels: "app=web", ip: "10.1.0.22", ready: true },
  ];
  const endpoints = Object.fromEntries(services.map((sv) => [sv.name, pods.filter((p) => p.labels === sv.selector && p.ready)]));
  return { services, pods, endpoints };
}
export const REQUESTS = ["shop.example.com/api/orders", "shop.example.com/api/cart", "shop.example.com/", "shop.example.com/api/orders", "admin.example.com/"];
export function route(s: Scenario) {
  const c = cluster(s);
  const rr: Record<string, number> = {};
  return REQUESTS.map((url) => {
    const [host, ...rest] = url.split("/");
    const path = "/" + rest.join("/");
    const rule = RULES.find((r) => r.host === host && path.startsWith(r.path));
    if (!rule) return { url, rule: null, service: null, pod: null, status: 404, note: "No Ingress rule for this host" };
    const eps = c.endpoints[rule.service];
    if (!eps.length) return { url, rule, service: rule.service, pod: null, status: 503, note: "Service has no endpoints: its selector matches no ready pods" };
    const i = (rr[rule.service] = (rr[rule.service] ?? -1) + 1) % eps.length;
    return { url, rule, service: rule.service, pod: eps[i].name, status: 200, note: `Load-balanced to ${eps[i].name} (${eps[i].ip})` };
  });
}
