// Stream a JSON answer token by token and parse whatever has arrived so far.
export const FULL = JSON.stringify({ title: "Reset your router", steps: ["Unplug it for 30 seconds", "Plug it back in", "Wait for the lights to go solid", "Reconnect your device"] });
export const CHUNKS = FULL.match(/.{1,6}/g) ?? [];
export const TTFT = 400;
export const PER_CHUNK = 70;

export type Partial = { title?: string; steps?: string[] };

function close(s: string) {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (const ch of s) {
    if (esc) { esc = false; continue; }
    if (inStr) { if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  return s + (inStr ? '"' : "") + stack.reverse().join("");
}

export function partialParse(s: string): Partial | null {
  for (let cut = s.length; cut > 0; cut--) {
    try { return JSON.parse(close(s.slice(0, cut))); } catch { /* try a shorter prefix */ }
  }
  return null;
}

export function strictParse(s: string): Partial | null {
  try { return JSON.parse(s); } catch { return null; }
}
