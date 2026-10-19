// Design search autocomplete. A day of query logs is counted, a trie is built with the
// top suggestions stored at every node, and each keystroke is answered from it.

export const LOG: [string, number][] = [
  ["how to cook rice", 9200],
  ["how to tie a tie", 8800],
  ["how to screenshot on mac", 8100],
  ["how to boil eggs", 7400],
  ["how to cook quinoa", 3100],
  ["how to cook salmon", 4600],
  ["how to code", 2900],
  ["how to convert pdf to word", 5200],
  ["how tall is the eiffel tower", 2600],
  ["how many ounces in a cup", 6900],
  ["how many weeks in a year", 5800],
  ["hotels near me", 12400],
  ["hotel california lyrics", 2100],
  ["house plants low light", 1800],
  ["weather tomorrow", 15100],
  ["weather radar", 7700],
  ["web development course", 2300],
  ["what time is it", 11900],
  ["what is my ip", 6400],
  ["whatsapp web", 13300],
  ["when is easter", 3900],
  ["where is my refund", 4400],
  ["why is the sky blue", 3300],
  ["python list comprehension", 2700],
  ["python sort dictionary by value", 2200],
  ["pizza near me", 10800],
  ["pinterest", 9600],
  ["pi day", 1500],
];
export const K = 5;

type Node = { children: Map<string, Node>; top: [string, number][] };
const node = (): Node => ({ children: new Map(), top: [] });

export function buildTrie(log: [string, number][] = LOG) {
  const root = node();
  let nodes = 1;
  for (const [q, c] of log) {
    let n = root;
    const path = [root];
    for (const ch of q) {
      let next = n.children.get(ch);
      if (!next) {
        next = node();
        n.children.set(ch, next);
        nodes++;
      }
      n = next;
      path.push(n);
    }
    // keep the top K at every node on the path
    for (const p of path) {
      p.top.push([q, c]);
      p.top.sort((a, b) => b[1] - a[1]);
      if (p.top.length > K) p.top.length = K;
    }
  }
  return { root, nodes };
}

export const TRIE = buildTrie();

export function suggest(prefix: string) {
  let n: Node | undefined = TRIE.root;
  let steps = 0;
  for (const ch of prefix.toLowerCase()) {
    n = n.children.get(ch);
    steps++;
    if (!n) return { list: [] as [string, number][], steps };
  }
  return { list: n.top, steps };
}

// Without precomputed top lists: scan every logged query for the prefix, then sort.
export function scan(prefix: string) {
  const p = prefix.toLowerCase();
  const hits = LOG.filter(([q]) => q.startsWith(p)).sort((a, b) => b[1] - a[1]);
  return { list: hits.slice(0, K), compared: LOG.length };
}

// Scale: requests a second from keystrokes, and what each design costs per request.
export const DAU = 200e6;
export const SEARCHES_PER_DAY = 6;
export const DISTINCT_QUERIES = 500e6;

export type Serve = "scan" | "trie" | "kv";
export const SERVES: { id: Serve; label: string; ms: number; one: string }[] = [
  { id: "scan", label: "Query the database", ms: 180, one: "SELECT … WHERE query LIKE 'prefix%' ORDER BY count DESC LIMIT 5 over the query table, on every keystroke." },
  { id: "trie", label: "Trie in memory", ms: 2, one: "Walk one node per character in an in-memory trie that already stores the top 5 at each node." },
  { id: "kv", label: "Prefix → top 5 table", ms: 1, one: "Precompute the top 5 for every prefix up to 20 characters and store them in a key-value store: one lookup." },
];

export type Client = { debounceMs: number; cachePrefixes: boolean };
export const DEBOUNCES = [0, 150, 300];
// Typing "how to cook rice" with a typo: "how to cool", backspace, then "k rice".
// Each entry is the text in the box after a keystroke, and the pause before the next.
const TYPED = "how to coo".split("").map((_, i, a) => a.slice(0, i + 1).join(""));
export const KEYSTROKES: [string, number][] = [
  ...TYPED.map((p, i): [string, number] => [p, [140, 120, 160, 420, 130, 110, 380, 150, 130, 140][i]]),
  ["how to cool", 450], // notices the typo
  ["how to coo", 160], // backspace
  ...["how to cook", "how to cook ", "how to cook r", "how to cook ri", "how to cook ric", "how to cook rice"].map((p, i): [string, number] => [p, [400, 130, 120, 150, 110, Infinity][i]]),
];

export function requestsWhileTyping(c: Client) {
  const sent: string[] = [];
  const seen = new Set<string>();
  for (const [p, gap] of KEYSTROKES) {
    // with debounce, a request goes out only when the user pauses at least that long
    if (c.debounceMs && gap < c.debounceMs) continue;
    if (c.cachePrefixes && seen.has(p)) continue;
    seen.add(p);
    sent.push(p);
  }
  return sent;
}

export function scale(c: Client) {
  const perSearch = requestsWhileTyping(c).length;
  const rps = (DAU * SEARCHES_PER_DAY * perSearch) / 86400;
  return { perSearch, rps, peak: rps * 3 };
}

// Storage for the prefix table: prefixes of every distinct query, shared prefixes counted once.
export const PREFIX_SHARE = 0.3; // fraction of a query's prefixes not shared with another query
export const PREFIX_ROW_BYTES = 5 * 30 + 20;
export const prefixTableGB = () => (DISTINCT_QUERIES * 20 * PREFIX_SHARE * PREFIX_ROW_BYTES) / 1e9;

export const fmt = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`);
