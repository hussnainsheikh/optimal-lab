// A small HTML parser that follows the shape of the HTML standard: a tokenizer, then a tree
// builder that fixes mistakes the way browsers do (implied html/head/body, a new <p> or <li>
// closing the open one, a <tbody> inside a table, misnested formatting reopened, stray end
// tags ignored). It covers the rules these sample pages need, not the whole spec; the trees
// match what Chrome's DOMParser builds for them. The script timeline is a separate model with
// illustrative network times.

export type Token =
  | { type: "doctype"; name: string }
  | { type: "start"; name: string; attrs: [string, string][]; selfClosing: boolean }
  | { type: "end"; name: string }
  | { type: "text"; data: string }
  | { type: "comment"; data: string };

const RAW_TEXT = new Set(["script", "style", "title", "textarea"]);

export function tokenize(html: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const text = (data: string) => {
    if (!data) return;
    const last = out[out.length - 1];
    if (last?.type === "text") last.data += data;
    else out.push({ type: "text", data });
  };
  while (i < html.length) {
    if (html[i] !== "<") {
      const j = html.indexOf("<", i);
      text(html.slice(i, j === -1 ? html.length : j));
      i = j === -1 ? html.length : j;
      continue;
    }
    if (html.startsWith("<!--", i)) {
      const j = html.indexOf("-->", i + 4);
      out.push({ type: "comment", data: html.slice(i + 4, j === -1 ? html.length : j) });
      i = j === -1 ? html.length : j + 3;
      continue;
    }
    if (/^<!doctype/i.test(html.slice(i, i + 9))) {
      const j = html.indexOf(">", i);
      out.push({ type: "doctype", name: html.slice(i + 9, j).trim().toLowerCase() });
      i = j + 1;
      continue;
    }
    const end = /^<\/([a-zA-Z][a-zA-Z0-9]*)\s*>/.exec(html.slice(i));
    if (end) {
      out.push({ type: "end", name: end[1].toLowerCase() });
      i += end[0].length;
      continue;
    }
    const start = /^<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/.exec(html.slice(i));
    if (!start) {
      text("<");
      i += 1;
      continue;
    }
    const name = start[1].toLowerCase();
    const attrs: [string, string][] = [];
    for (const m of start[2].matchAll(/([^\s=>\/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g)) {
      attrs.push([m[1].toLowerCase(), (m[2] ?? "").replace(/^["']|["']$/g, "")]);
    }
    out.push({ type: "start", name, attrs, selfClosing: start[3] === "/" });
    i += start[0].length;
    if (RAW_TEXT.has(name)) {
      const close = html.toLowerCase().indexOf(`</${name}`, i);
      const stop = close === -1 ? html.length : close;
      text(html.slice(i, stop));
      i = stop;
    }
  }
  return out;
}

export type El = { name: string; attrs: [string, string][]; children: Node[]; implied?: boolean; reopened?: boolean };
export type Node = El | { text: string };
export const isEl = (n: Node): n is El => "name" in n;

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "wbr"]);
const HEAD_TAGS = new Set(["base", "link", "meta", "script", "style", "title", "noscript"]);
const FORMATTING = new Set(["a", "b", "big", "code", "em", "font", "i", "s", "small", "strike", "strong", "tt", "u"]);
const CLOSES_P = new Set(["address", "article", "aside", "blockquote", "div", "dl", "fieldset", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "main", "nav", "ol", "p", "pre", "section", "table", "ul", "li"]);
const SPECIAL = new Set([...CLOSES_P, "body", "html", "head", "td", "th", "tr", "tbody", "thead", "tfoot", "img", "br", "input", "button", "li"]);
const IMPLIED_END = new Set(["dd", "dt", "li", "optgroup", "option", "p", "rb", "rp", "rt", "rtc"]);
const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);

export type Fix = { what: string };

export function buildTree(tokens: Token[]) {
  const fixes: Fix[] = [];
  const el = (name: string, attrs: [string, string][] = [], implied = false): El => ({ name, attrs, children: [], ...(implied ? { implied } : {}) });
  let html: El | null = null;
  let head: El | null = null;
  let body: El | null = null;
  const stack: El[] = [];
  const formatting: El[] = []; // the list of active formatting elements
  const current = () => stack[stack.length - 1];
  const insert = (e: El) => {
    current().children.push(e);
    if (!VOID.has(e.name)) stack.push(e);
  };
  const insertText = (data: string) => {
    const kids = current().children;
    const last = kids[kids.length - 1];
    if (last && !isEl(last)) last.text += data;
    else kids.push({ text: data });
  };
  const ensureHtml = () => {
    if (html) return;
    html = el("html", [], true);
    stack.push(html);
    fixes.push({ what: "No <html> tag: the parser made one" });
  };
  const ensureHead = () => {
    ensureHtml();
    if (head) return;
    head = el("head", [], true);
    html!.children.push(head);
    stack.push(head);
    fixes.push({ what: "No <head> tag: the parser made one" });
  };
  const ensureBody = () => {
    ensureHead();
    if (body) return;
    while (current() !== html) stack.pop();
    body = el("body", [], true);
    html!.children.push(body);
    stack.push(body);
    fixes.push({ what: "No <body> tag: the parser made one" });
  };
  const inScope = (name: string, button = false) => {
    for (let k = stack.length - 1; k >= 0; k--) {
      const n = stack[k].name;
      if (n === name) return true;
      if (["html", "table", "td", "th"].includes(n) || (button && n === "button")) return false;
    }
    return false;
  };
  const generateImpliedEnd = (except?: string) => {
    while (IMPLIED_END.has(current().name) && current().name !== except) stack.pop();
  };
  const popUntil = (name: string) => {
    while (stack.length && stack.pop()!.name !== name) {
      /* keep popping */
    }
  };
  const closeP = (why: string) => {
    if (!inScope("p", true)) return;
    generateImpliedEnd("p");
    popUntil("p");
    fixes.push({ what: `An open <p> was closed because ${why}` });
  };
  const reconstruct = () => {
    for (let k = 0; k < formatting.length; k++) {
      const f = formatting[k];
      if (stack.includes(f)) continue;
      const copy: El = { name: f.name, attrs: f.attrs, children: [], reopened: true };
      insert(copy);
      formatting[k] = copy;
      fixes.push({ what: `<${f.name}> was still open when its parent closed, so the parser reopened it` });
    }
  };

  for (const t of tokens) {
    if (t.type === "doctype") continue;
    if (t.type === "comment") continue;
    if (t.type === "text") {
      if (stack.length && RAW_TEXT.has(current().name)) {
        insertText(t.data);
        continue;
      }
      if (!body && /^\s*$/.test(t.data)) continue; // whitespace before the body is dropped
      if (!body) ensureBody();
      const inTable = ["table", "tbody", "tr"].includes(current().name);
      if (inTable && /^\s*$/.test(t.data)) continue;
      reconstruct();
      insertText(t.data);
      continue;
    }
    if (t.type === "start") {
      const n = t.name;
      if (n === "html") {
        if (!html) {
          html = el("html", t.attrs);
          stack.push(html);
        }
        continue;
      }
      if (n === "head") {
        ensureHtml();
        if (!head) {
          head = el("head", t.attrs);
          html!.children.push(head);
          stack.push(head);
        }
        continue;
      }
      if (n === "body") {
        ensureHead();
        if (!body) {
          while (current() !== html) stack.pop();
          body = el("body", t.attrs);
          html!.children.push(body);
          stack.push(body);
        }
        continue;
      }
      if (!body && HEAD_TAGS.has(n)) {
        ensureHead();
        if (current() !== head) {
          while (current() !== html) stack.pop();
          stack.push(head!);
        }
        insert(el(n, t.attrs));
        continue;
      }
      ensureBody();
      if (n === "li") {
        for (let k = stack.length - 1; k >= 0; k--) {
          const node = stack[k];
          if (node.name === "li") {
            generateImpliedEnd("li");
            popUntil("li");
            fixes.push({ what: "A new <li> closed the open <li>" });
            break;
          }
          if (SPECIAL.has(node.name) && !["address", "div", "p"].includes(node.name)) break;
        }
      }
      if (CLOSES_P.has(n)) closeP(`<${n}> started`);
      if (HEADINGS.has(n) && HEADINGS.has(current().name)) {
        stack.pop();
        fixes.push({ what: `<${n}> can't sit inside another heading, so the open one was closed` });
      }
      if (n === "tr" && current().name === "table") {
        insert(el("tbody", [], true));
        fixes.push({ what: "A <tr> directly in <table>: the parser added <tbody>" });
      }
      if ((n === "td" || n === "th") && ["td", "th"].includes(current().name)) {
        stack.pop();
        fixes.push({ what: `A new <${n}> closed the open cell` });
      }
      if (!["table", "tbody", "tr"].includes(n)) reconstruct();
      const e = el(n, t.attrs);
      insert(e);
      if (FORMATTING.has(n)) formatting.push(e);
      continue;
    }
    // end tags
    const n = t.name;
    if (n === "head") {
      if (current() === head) stack.pop();
      continue;
    }
    if (n === "body" || n === "html") continue;
    if (!body && HEAD_TAGS.has(n)) {
      if (current().name === n) stack.pop();
      continue;
    }
    if (FORMATTING.has(n)) {
      const fi = formatting.map((f) => f.name).lastIndexOf(n);
      const f = formatting[fi];
      if (!f || !stack.includes(f)) {
        fixes.push({ what: `A stray </${n}> with nothing to close was ignored` });
        continue;
      }
      if (current() !== f) fixes.push({ what: `</${n}> closed before the tags inside it, so those were closed too` });
      while (stack.pop() !== f) {
        /* pop everything opened inside it */
      }
      formatting.splice(fi, 1);
      continue;
    }
    if (n === "p" && !inScope("p", true)) {
      fixes.push({ what: "A </p> with no open <p>: the parser inserted an empty <p>" });
      insert(el("p", [], true));
      stack.pop();
      continue;
    }
    if (CLOSES_P.has(n) || ["td", "th", "tr", "tbody"].includes(n)) {
      const tableEnd = ["td", "th", "tr", "tbody", "table"].includes(n);
      if (tableEnd ? !stack.some((e) => e.name === n) : !inScope(n)) {
        fixes.push({ what: `A stray </${n}> with nothing to close was ignored` });
        continue;
      }
      generateImpliedEnd(n);
      if (current().name !== n) fixes.push({ what: `</${n}> also closed the <${current().name}> still open inside it` });
      popUntil(n);
      continue;
    }
    // any other end tag
    let handled = false;
    for (let k = stack.length - 1; k >= 0; k--) {
      const node = stack[k];
      if (node.name === n) {
        generateImpliedEnd(n);
        if (current() !== node) fixes.push({ what: `</${n}> closed the tags still open inside it` });
        popUntil(n);
        handled = true;
        break;
      }
      if (SPECIAL.has(node.name)) break;
    }
    if (!handled) fixes.push({ what: `A stray </${n}> with nothing to close was ignored` });
  }
  ensureBody();
  return { root: html! as El, fixes };
}

/** One line per node, indented, the way DevTools' Elements panel lists them. */
export function outline(root: El): { depth: number; label: string; implied?: boolean; reopened?: boolean }[] {
  const rows: { depth: number; label: string; implied?: boolean; reopened?: boolean }[] = [];
  const walk = (n: Node, depth: number) => {
    if (!isEl(n)) {
      const t = n.text.replace(/\s+/g, " ");
      if (t.trim()) rows.push({ depth, label: `"${t}"` });
      return;
    }
    const attrs = n.attrs.map(([k, v]) => (v ? ` ${k}="${v}"` : ` ${k}`)).join("");
    rows.push({ depth, label: `<${n.name}${attrs}>`, implied: n.implied, reopened: n.reopened });
    n.children.forEach((c) => walk(c, depth + 1));
  };
  walk(root, 0);
  return rows;
}

/** Serialize like element.outerHTML, for checking against a real browser. */
export function serialize(n: Node): string {
  if (!isEl(n)) return n.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const attrs = n.attrs.map(([k, v]) => ` ${k}="${v}"`).join("");
  if (VOID.has(n.name)) return `<${n.name}${attrs}>`;
  const inner = RAW_TEXT.has(n.name) && n.name !== "textarea" ? n.children.map((c) => (isEl(c) ? serialize(c) : c.text)).join("") : n.children.map(serialize).join("");
  return `<${n.name}${attrs}>${inner}</${n.name}>`;
}

export type SampleId = "clean" | "missing" | "misnested" | "table";
export const SAMPLES: { id: SampleId; label: string; html: string }[] = [
  {
    id: "clean",
    label: "Well formed",
    html: `<!DOCTYPE html>\n<html>\n<head><title>Shoe sale</title><link rel="stylesheet" href="app.css"></head>\n<body><h1>Sale</h1><p>Up to <b>50%</b> off</p><img src="hero.jpg" alt=""></body>\n</html>`,
  },
  {
    id: "missing",
    label: "Missing tags",
    html: `<title>Shoe sale</title>\n<h1>Sale</h1>\n<p>Up to 50% off\n<p>Ends Friday\n<ul><li>Shoes<li>Bags</ul>`,
  },
  {
    id: "misnested",
    label: "Misnested tags",
    html: `<!DOCTYPE html>\n<p>Up to <b>50% <i>off</b> today</i></p>\n<div>Free returns</span></div>`,
  },
  {
    id: "table",
    label: "A table",
    html: `<!DOCTYPE html>\n<table>\n<tr><td>Shoes</td><td>$40</td></tr>\n<tr><td>Bags<td>$25</tr>\n</table>`,
  },
];

export function parse(id: SampleId) {
  const html = SAMPLES.find((s) => s.id === id)!.html;
  const tokens = tokenize(html);
  const { root, fixes } = buildTree(tokens);
  const elements = outline(root).filter((r) => r.label.startsWith("<")).length;
  return { html, bytes: new TextEncoder().encode(html).length, tokens, root, fixes, rows: outline(root), elements };
}

export function tokenLabel(t: Token): string {
  if (t.type === "doctype") return `DOCTYPE ${t.name}`;
  if (t.type === "start") return `start <${t.name}>`;
  if (t.type === "end") return `end </${t.name}>`;
  if (t.type === "comment") return "comment";
  const s = t.data.replace(/\s+/g, " ");
  return s.trim() ? `text "${s.trim()}"` : "whitespace";
}

// --- scripts and the parser -------------------------------------------------------------

export type ScriptMode = "classic" | "defer" | "async" | "module";
export const SCRIPT_MODES: { id: ScriptMode; label: string; tag: string }[] = [
  { id: "classic", label: "<script>", tag: `<script src="app.js"></script>` },
  { id: "defer", label: "defer", tag: `<script src="app.js" defer></script>` },
  { id: "async", label: "async", tag: `<script src="app.js" async></script>` },
  { id: "module", label: "type=module", tag: `<script type="module" src="app.js"></script>` },
];

// Illustrative times in ms for a page whose <head> holds a stylesheet and app.js, and whose
// body has two images. The HTML takes 120 ms to arrive; parsing it all takes 40 ms of work.
export const NET = { htmlArrives: 120, scriptAt: 15, cssAt: 10, cssLoad: 90, scriptLoad: 160, scriptRun: 60, imgLoad: 140, parseWork: 40 };

export type Bar = { lane: "network" | "parser" | "js"; label: string; from: number; to: number; tone?: "bad" | "good" };

export function scriptTimeline(mode: ScriptMode, preloadScanner: boolean) {
  const bars: Bar[] = [];
  const cssReady = NET.cssAt + NET.cssLoad;
  const scriptLoaded = NET.scriptAt + NET.scriptLoad;
  bars.push({ lane: "network", label: "app.css", from: NET.cssAt, to: cssReady });
  bars.push({ lane: "network", label: "app.js", from: NET.scriptAt, to: scriptLoaded });
  const blocking = mode === "classic";
  let parseEnd: number;
  let runFrom: number;
  let imgStart: number;
  if (blocking) {
    // The parser stops at the tag. The script waits for itself and for the stylesheet
    // (scripts may read styles), runs, and only then does parsing continue.
    bars.push({ lane: "parser", label: "parse <head>", from: 0, to: NET.scriptAt });
    runFrom = Math.max(scriptLoaded, cssReady);
    bars.push({ lane: "parser", label: "blocked", from: NET.scriptAt, to: runFrom + NET.scriptRun, tone: "bad" });
    bars.push({ lane: "js", label: "run app.js", from: runFrom, to: runFrom + NET.scriptRun });
    const resume = runFrom + NET.scriptRun;
    parseEnd = resume + (NET.parseWork - NET.scriptAt);
    bars.push({ lane: "parser", label: "parse <body>", from: resume, to: parseEnd });
    // Without the preload scanner the images are found only when the parser reaches them.
    imgStart = preloadScanner ? NET.scriptAt + 5 : resume + 5;
  } else {
    // The HTML keeps arriving until 120 ms, so parsing can't finish before then.
    parseEnd = Math.max(NET.parseWork, NET.htmlArrives);
    bars.push({ lane: "parser", label: "parse the page", from: 0, to: parseEnd });
    imgStart = 25;
    if (mode === "async") {
      runFrom = scriptLoaded; // whenever it arrives, even mid-parse
    } else {
      runFrom = Math.max(scriptLoaded, cssReady, parseEnd); // defer and module wait for the parse
    }
    bars.push({ lane: "js", label: "run app.js", from: runFrom, to: runFrom + NET.scriptRun });
    if (mode === "async" && runFrom < parseEnd) bars.push({ lane: "parser", label: "paused", from: runFrom, to: runFrom + NET.scriptRun, tone: "bad" });
  }
  if (mode === "async" && runFrom < parseEnd) parseEnd += NET.scriptRun;
  bars.push({ lane: "network", label: "2 images", from: imgStart, to: imgStart + NET.imgLoad });
  const scriptEnd = runFrom + NET.scriptRun;
  // DOMContentLoaded fires after parsing and after defer/module scripts, not after async ones.
  const dcl = mode === "async" ? parseEnd : Math.max(parseEnd, scriptEnd);
  // The body can be painted once it's parsed and the stylesheet has arrived.
  const paint = Math.max(cssReady, parseEnd - (mode === "async" && runFrom < parseEnd ? NET.scriptRun : 0));
  return { bars, dcl, paint, parseEnd, scriptStart: runFrom, scriptEnd, imgStart, end: Math.max(dcl, scriptEnd, imgStart + NET.imgLoad), blockedMs: blocking ? runFrom + NET.scriptRun - NET.scriptAt : 0 };
}
