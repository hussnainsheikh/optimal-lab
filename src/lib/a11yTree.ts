// A product page fragment written two ways, part by part: generic divs styled to look right,
// or semantic HTML. The accessibility tree is derived the way browsers do it: each element's
// role comes from its tag (HTML-AAM), its name from the accessible name computation (labels,
// alt, aria-label, then content, then title and placeholder), and generic containers drop out.
// From that tree we produce what a screen reader reads, and its lists of headings, landmarks,
// links and form fields.

export type PartId = "nav" | "heading" | "image" | "button" | "field" | "links" | "icon" | "main";
export type Part = { id: PartId; label: string; soup: string; semantic: string };

export const PARTS: Part[] = [
  { id: "main", label: "Main content area", soup: '<div id="content">…</div>', semantic: "<main>…</main>" },
  { id: "nav", label: "Site navigation", soup: '<div class="nav"><div onclick="go(\'/\')">Home</div> <div onclick="go(\'/sale\')">Sale</div></div>', semantic: '<nav><a href="/">Home</a> <a href="/sale">Sale</a></nav>' },
  { id: "heading", label: "Page title", soup: '<div class="title">Spring sale</div>', semantic: "<h1>Spring sale</h1>" },
  { id: "image", label: "Product photo", soup: '<img src="IMG_4021.jpg">', semantic: '<img src="IMG_4021.jpg" alt="Trail runner 2, blue">' },
  { id: "button", label: "Add to cart", soup: '<div class="btn" onclick="add()">Add to cart</div>', semantic: "<button>Add to cart</button>" },
  { id: "field", label: "Email for restock alerts", soup: '<input type="email" placeholder="Email">', semantic: '<label for="e">Email for restock alerts</label> <input id="e" type="email">' },
  { id: "links", label: "Article links", soup: '<a href="/a/1">Read more</a> <a href="/a/2">Read more</a>', semantic: '<a href="/a/1">Read more about sizing</a> <a href="/a/2">Read more about returns</a>' },
  { id: "icon", label: "Close button", soup: '<button><svg …/></button>', semantic: '<button aria-label="Close"><svg aria-hidden="true" …/></button>' },
];

export type Fixed = Record<PartId, boolean>;
export const SOUP: Fixed = { main: false, nav: false, heading: false, image: false, button: false, field: false, links: false, icon: false };
export const SEMANTIC: Fixed = { main: true, nav: true, heading: true, image: true, button: true, field: true, links: true, icon: true };

export type Node = { role: string; name: string; nameFrom: string; level?: number; focusable: boolean; activates: boolean; children?: Node[]; issue?: string; landmark?: boolean };

export function tree(f: Fixed): Node {
  const kids: Node[] = [];
  const nav: Node = f.nav
    ? { role: "navigation", name: "", nameFrom: "", focusable: false, activates: false, landmark: true, children: ["Home", "Sale"].map((n) => ({ role: "link", name: n, nameFrom: "content", focusable: true, activates: true })) }
    : { role: "generic", name: "", nameFrom: "", focusable: false, activates: false, children: ["Home", "Sale"].map((n) => ({ role: "text", name: n, nameFrom: "content", focusable: false, activates: false, issue: "looks like a link, but it's text: not focusable, not in the links list" })) };
  kids.push(nav);
  const main: Node[] = [];
  main.push(f.heading ? { role: "heading", level: 1, name: "Spring sale", nameFrom: "content", focusable: false, activates: false } : { role: "text", name: "Spring sale", nameFrom: "content", focusable: false, activates: false, issue: "big bold text, but not a heading: nobody can jump to it" });
  main.push(f.image ? { role: "image", name: "Trail runner 2, blue", nameFrom: "alt", focusable: false, activates: false } : { role: "image", name: "IMG_4021.jpg", nameFrom: "file name (no alt)", focusable: false, activates: false, issue: "no alt: screen readers fall back to reading the file name" });
  main.push(f.button ? { role: "button", name: "Add to cart", nameFrom: "content", focusable: true, activates: true } : { role: "text", name: "Add to cart", nameFrom: "content", focusable: false, activates: false, issue: "a div with a click handler: can't be reached with Tab or pressed with Enter" });
  main.push(f.field ? { role: "textbox", name: "Email for restock alerts", nameFrom: "label", focusable: true, activates: false } : { role: "textbox", name: "Email", nameFrom: "placeholder", focusable: true, activates: false, issue: "named only by its placeholder, which vanishes once you type and isn't a label" });
  for (const [i, topic] of ["sizing", "returns"].entries()) main.push(f.links ? { role: "link", name: `Read more about ${topic}`, nameFrom: "content", focusable: true, activates: true } : { role: "link", name: "Read more", nameFrom: "content", focusable: true, activates: true, issue: i === 0 ? "every link says 'Read more': useless in a list of links" : undefined });
  main.push(f.icon ? { role: "button", name: "Close", nameFrom: "aria-label", focusable: true, activates: true } : { role: "button", name: "", nameFrom: "nothing", focusable: true, activates: true, issue: "a button with no name: announced as just 'button'" });
  kids.push(f.main ? { role: "main", name: "", nameFrom: "", focusable: false, activates: false, landmark: true, children: main } : { role: "generic", name: "", nameFrom: "", focusable: false, activates: false, children: main });
  return { role: "document", name: "Spring sale – Shop", nameFrom: "title", focusable: false, activates: false, children: kids };
}

/** The tree as the accessibility API exposes it: generic containers are dropped, their children kept. */
export function exposed(n: Node): Node[] {
  const kids = (n.children ?? []).flatMap(exposed);
  if (n.role === "generic") return kids;
  return [{ ...n, children: kids }];
}

export function flatten(n: Node, depth = 0): { node: Node; depth: number }[] {
  return [{ node: n, depth }, ...(n.children ?? []).flatMap((c) => flatten(c, depth + 1))];
}

const say = (n: Node) => {
  if (n.role === "document") return null;
  if (n.role === "text") return n.name;
  if (n.role === "navigation" || n.role === "main") return `${n.role} landmark`;
  if (n.role === "heading") return `heading level ${n.level}, ${n.name}`;
  if (n.role === "image") return `image, ${n.name}`;
  if (n.role === "textbox") return `${n.name ? n.name + ", " : ""}edit text`;
  return `${n.role}${n.name ? `, ${n.name}` : ""}`;
};

export function screenReader(f: Fixed) {
  const nodes = flatten(exposed(tree(f))[0]).map((x) => x.node);
  const readout = nodes.map(say).filter((s): s is string => !!s);
  const headings = nodes.filter((n) => n.role === "heading").map((n) => `${n.level} ${n.name}`);
  const landmarks = nodes.filter((n) => n.landmark).map((n) => n.role);
  const links = nodes.filter((n) => n.role === "link").map((n) => n.name);
  const tabStops = nodes.filter((n) => n.focusable).map((n) => `${n.role}${n.name ? `: ${n.name}` : ""}`);
  const issues = nodes.filter((n) => n.issue).map((n) => n.issue!);
  return { readout, headings, landmarks, links, tabStops, issues };
}
