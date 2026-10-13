// A "preview this link" feature: the server fetches a URL the user typed.
export type Defense = "none" | "blocklist" | "resolve-check";
export const DEFENSES: { id: Defense; label: string }[] = [
  { id: "none", label: "Fetch anything" },
  { id: "blocklist", label: "Block strings like 169.254 and localhost" },
  { id: "resolve-check", label: "Resolve, block private IPs, recheck redirects" },
];
export const URLS = [
  { url: "https://example.com/post", ip: "93.184.216.34", private: false, sneaky: false, what: "A normal page" },
  { url: "http://169.254.169.254/latest/meta-data/iam/", ip: "169.254.169.254", private: true, sneaky: false, what: "Cloud metadata: temporary AWS keys" },
  { url: "http://localhost:6379/", ip: "127.0.0.1", private: true, sneaky: false, what: "Internal Redis" },
  { url: "http://2852039166/latest/meta-data/", ip: "169.254.169.254", private: true, sneaky: true, what: "Metadata IP written as one decimal number" },
  { url: "https://evil.example/r", ip: "203.0.113.9 → 302 → 10.0.0.5", private: true, sneaky: true, what: "Public URL that redirects to an internal admin panel" },
];
export function fetchAs(i: number, d: Defense) {
  const u = URLS[i];
  const blockedByString = /169\.254|localhost|127\.0\.0\.1/.test(u.url);
  const blocked = d === "blocklist" ? blockedByString : d === "resolve-check" ? u.private : false;
  return { blocked, leak: u.private && !blocked };
}
