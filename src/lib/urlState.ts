// A product list's filters, kept in React state or in the URL's query string. The URL is
// built and read with the browser's own URLSearchParams; the history stack is simulated to
// show what pushState on every keystroke does to the Back button; and parsing a hand-edited
// URL shows why every value read from it has to be checked.

export type Filters = { q: string; category: string; max: number; sort: string; tags: string[]; page: number };
export type Key = keyof Filters;
export const DEFAULTS: Filters = { q: "", category: "all", max: 200, sort: "relevance", tags: [], page: 1 };
export const CATEGORIES = ["all", "shoes", "bags", "hats"];
export const SORTS = ["relevance", "price-asc", "price-desc", "newest"];
export const TAGS = ["waterproof", "vegan", "sale"];
export const PARAM: Record<Key, string> = { q: "q", category: "category", max: "max", sort: "sort", tags: "tag", page: "page" };
export const BASE = "https://shop.example/products";

export type Opts = { inUrl: Record<Key, boolean>; typing: "push" | "replace"; omitDefaults: boolean; validate: boolean };
export const IN_STATE: Opts = { inUrl: { q: false, category: false, max: false, sort: false, tags: false, page: false }, typing: "push", omitDefaults: false, validate: false };
export const IN_URL: Opts = { inUrl: { q: true, category: true, max: true, sort: true, tags: true, page: true }, typing: "replace", omitDefaults: true, validate: true };

export function toQuery(f: Filters, o: Opts): string {
  const p = new URLSearchParams();
  (Object.keys(PARAM) as Key[]).forEach((k) => {
    if (!o.inUrl[k]) return;
    const v = f[k];
    if (o.omitDefaults && JSON.stringify(v) === JSON.stringify(DEFAULTS[k])) return;
    if (Array.isArray(v)) v.forEach((t) => p.append(PARAM[k], t));
    else p.set(PARAM[k], String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

export type Parsed = { filters: Filters; notes: { key: Key; raw: string; used: string; ok: boolean }[] };

/** Read filters back from a query string, as the page does on load. */
export function parse(search: string, o: Opts): Parsed {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const f: Filters = { ...DEFAULTS, tags: [] };
  const notes: Parsed["notes"] = [];
  const note = (key: Key, raw: string, used: unknown, ok: boolean) => notes.push({ key, raw, used: JSON.stringify(used), ok });
  const q = p.get("q");
  if (q !== null) {
    f.q = o.validate ? q.slice(0, 100) : q;
    note("q", q, f.q, true);
  }
  const cat = p.get("category");
  if (cat !== null) {
    const ok = CATEGORIES.includes(cat);
    f.category = ok || !o.validate ? cat : DEFAULTS.category;
    note("category", cat, f.category, ok);
  }
  const max = p.get("max");
  if (max !== null) {
    const n = Number(max);
    const ok = max.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 1000;
    f.max = ok ? n : o.validate ? DEFAULTS.max : n;
    note("max", max, f.max, ok);
  }
  const sort = p.get("sort");
  if (sort !== null) {
    const ok = SORTS.includes(sort);
    f.sort = ok || !o.validate ? sort : DEFAULTS.sort;
    note("sort", sort, f.sort, ok);
  }
  const tags = p.getAll("tag");
  if (tags.length) {
    const good = tags.filter((t) => TAGS.includes(t));
    f.tags = o.validate ? [...new Set(good)] : tags;
    note("tags", tags.join(","), f.tags, good.length === tags.length);
  }
  const page = p.get("page");
  if (page !== null) {
    const n = Number(page);
    const ok = Number.isInteger(n) && n >= 1 && n <= 500;
    f.page = ok ? n : o.validate ? DEFAULTS.page : n;
    note("page", page, f.page, ok);
  }
  return { filters: f, notes };
}

/** What a bad value does when it isn't checked. */
export function consequences(parsed: Parsed): string[] {
  const out: string[] = [];
  const f = parsed.filters;
  if (Number.isNaN(f.max)) out.push("max is NaN: every price comparison is false, so the list is empty");
  else if (f.max < 0) out.push("a negative max price: the list is empty, with no hint why");
  if (!SORTS.includes(f.sort)) out.push(`sort "${f.sort}" is sent to the API as an ORDER BY column`);
  if (!CATEGORIES.includes(f.category)) out.push(`category "${f.category}" matches nothing`);
  if (!Number.isInteger(f.page) || f.page < 1) out.push(`page ${f.page} gives a negative OFFSET`);
  if (f.q.length > 100) out.push("a 100+ character search is sent to the search service as is");
  return out;
}

/** Type a search one key at a time: how many history entries does it leave behind? */
export function typingHistory(text: string, o: Opts) {
  const entries = [BASE];
  if (!o.inUrl.q) return { entries, pushed: 0, backGoesTo: "the page before the shop" };
  for (let i = 1; i <= text.length; i++) {
    const url = BASE + toQuery({ ...DEFAULTS, q: text.slice(0, i) }, o);
    // pushState adds an entry per keystroke; replaceState rewrites the current one.
    if (o.typing === "push") entries.push(url);
    else entries[entries.length - 1] = url;
  }
  return { entries, pushed: entries.length - 1, backGoesTo: entries.length > 1 ? entries[entries.length - 2] : "the page before the shop" };
}

export type Scenario = "reload" | "share" | "back";
export const SCENARIOS: { id: Scenario; label: string; what: string }[] = [
  { id: "reload", label: "Reload", what: "The page is reloaded." },
  { id: "share", label: "Share the link", what: "The URL is pasted to a colleague, who opens it." },
  { id: "back", label: "Open a product, then Back", what: "A product page is opened, then the Back button pressed." },
];

/** Which filters survive each scenario: only what's in the URL. */
export function survives(o: Opts, s: Scenario, f: Filters) {
  return (Object.keys(PARAM) as Key[]).map((k) => {
    const set = JSON.stringify(f[k]) !== JSON.stringify(DEFAULTS[k]);
    // React state is lost on reload and on a shared link; Back remounts the list page too.
    const kept = !set || o.inUrl[k];
    return { key: k, set, kept, note: !set ? "default" : kept ? (s === "share" ? "the colleague sees it" : "restored from the URL") : s === "share" ? "the colleague doesn't get it" : "lost: it lived in component state" };
  });
}
