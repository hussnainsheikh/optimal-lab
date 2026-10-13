// A tiny model of Git's object store: blobs, trees, commits and refs.
export type Obj = { id: string; type: "blob" | "tree" | "commit"; label: string; points: string[] };
export type Frame = { cmd: string; text: string; objects: Obj[]; refs: Record<string, string>; head: string; added: string[] };

function hash(s: string) {
  let h = 0x811c9dc5;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, "0").slice(0, 7);
}

export function frames(): Frame[] {
  const objects: Obj[] = [];
  const refs: Record<string, string> = {};
  let head = "main";
  const out: Frame[] = [];
  const put = (type: Obj["type"], label: string, content: string, points: string[] = []) => {
    const id = hash(type + content);
    if (!objects.find((o) => o.id === id)) objects.push({ id, type, label, points });
    return id;
  };
  const snap = (cmd: string, text: string, before: number) =>
    out.push({ cmd, text, objects: objects.map((o) => ({ ...o })), refs: { ...refs }, head, added: objects.slice(before).map((o) => o.id) });

  out.push({ cmd: "git init", text: "An empty repository: no objects yet, and main doesn't point anywhere.", objects: [], refs: {}, head, added: [] });

  let n = objects.length;
  const readme = put("blob", "README.md: # Shop", "# Shop");
  const app1 = put("blob", "app.js: v1", "console.log(1)");
  const tree1 = put("tree", "tree: README.md, app.js", readme + app1, [readme, app1]);
  const c1 = put("commit", "commit: Initial", tree1 + "Initial", [tree1]);
  refs.main = c1;
  snap("git commit -m \"Initial\"", "Each file becomes a blob named by the hash of its content. A tree lists the blobs; the commit points at the tree. main now points at the commit.", n);

  n = objects.length;
  const app2 = put("blob", "app.js: v2", "console.log(2)");
  const tree2 = put("tree", "tree: README.md, app.js", readme + app2, [readme, app2]);
  const c2 = put("commit", "commit: Fix app", tree2 + "Fix" + c1, [tree2, c1]);
  refs.main = c2;
  snap("git commit -am \"Fix app\"", "Only app.js changed, so only one new blob. README.md's blob is reused because its content and hash are the same. The new commit points at its parent.", n);

  n = objects.length;
  refs.feature = c2;
  head = "feature";
  snap("git switch -c feature", "A branch is a 41-byte file holding a commit id. Creating one copies nothing: no new objects at all.", n);

  n = objects.length;
  const pay = put("blob", "pay.js: new", "pay()");
  const tree3 = put("tree", "tree: README.md, app.js, pay.js", readme + app2 + pay, [readme, app2, pay]);
  const c3 = put("commit", "commit: Add payments", tree3 + "Pay" + c2, [tree3, c2]);
  refs.feature = c3;
  snap("git commit -m \"Add payments\"", "The commit moves feature forward; main stays where it was. HEAD says which branch you're on.", n);

  n = objects.length;
  refs.main = c3;
  head = "main";
  snap("git switch main && git merge feature", "main is behind feature with nothing new of its own, so the merge just moves the main pointer forward: a fast-forward.", n);
  return out;
}
