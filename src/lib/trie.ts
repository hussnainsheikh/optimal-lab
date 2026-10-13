// A trie of words, and prefix lookups that walk it.
export const WORDS = ["car", "card", "care", "cat", "do", "dog", "dot"];
export type Node = { ch: string; path: string; end: boolean; kids: Node[] };

export function build(): Node {
  const root: Node = { ch: "", path: "", end: false, kids: [] };
  for (const w of WORDS) {
    let n = root;
    for (const ch of w) {
      let k = n.kids.find((x) => x.ch === ch);
      if (!k) { k = { ch, path: n.path + ch, end: false, kids: [] }; n.kids.push(k); }
      n = k;
    }
    n.end = true;
  }
  return root;
}

export function lookup(root: Node, prefix: string) {
  let n: Node | undefined = root;
  const walked: string[] = [""];
  for (const ch of prefix) {
    n = n.kids.find((x) => x.ch === ch);
    if (!n) return { found: false, walked, words: [] as string[], steps: walked.length - 1 };
    walked.push(n.path);
  }
  const words: string[] = [];
  const dfs = (x: Node) => { if (x.end) words.push(x.path); x.kids.forEach(dfs); };
  dfs(n);
  return { found: true, walked, words, steps: prefix.length };
}

export function count(n: Node): number { return 1 + n.kids.reduce((a, k) => a + count(k), 0); }
export const PREFIXES = ["ca", "car", "do", "c", "z"];
