// Two people edit the same text at the same time. Each applies their own change at
// once, then receives the other's. Applied naively by position, the copies drift
// apart. Operational transformation (OT) adjusts each incoming operation against the
// ones it missed; a CRDT gives every character an identity so positions never matter.
// Both algorithms are implemented here and run on the scenarios below.

export type Op = { kind: "ins"; pos: number; ch: string } | { kind: "del"; pos: number };
export type Scenario = { id: string; label: string; start: string; a: Op; b: Op; what: string };

export const SCENARIOS: Scenario[] = [
  { id: "two-inserts", label: "Two inserts", start: "cat", a: { kind: "ins", pos: 3, ch: "s" }, b: { kind: "ins", pos: 1, ch: "h" }, what: "Ann adds “s” at the end; Ben adds “h” after the “c”." },
  { id: "insert-delete", label: "Insert and delete", start: "cart", a: { kind: "del", pos: 2 }, b: { kind: "ins", pos: 4, ch: "s" }, what: "Ann deletes the “r”; Ben adds “s” at the end." },
  { id: "same-spot", label: "Same spot", start: "cat", a: { kind: "ins", pos: 1, ch: "o" }, b: { kind: "ins", pos: 1, ch: "h" }, what: "Both type at the same position at the same moment." },
];

export function applyOp(text: string, op: Op): string {
  if (op.kind === "ins") return text.slice(0, op.pos) + op.ch + text.slice(op.pos);
  return text.slice(0, op.pos) + text.slice(op.pos + 1);
}

// Transform `op` so it can be applied after `other` has already been applied.
// `opWins` breaks ties for two inserts at the same position.
export function transform(op: Op, other: Op, opWins: boolean): Op {
  if (op.kind === "ins" && other.kind === "ins") {
    if (other.pos < op.pos || (other.pos === op.pos && !opWins)) return { ...op, pos: op.pos + 1 };
    return op;
  }
  if (op.kind === "ins" && other.kind === "del") return other.pos < op.pos ? { ...op, pos: op.pos - 1 } : op;
  if (op.kind === "del" && other.kind === "ins") return other.pos <= op.pos ? { ...op, pos: op.pos + 1 } : op;
  // del vs del
  if (op.kind === "del" && other.kind === "del") {
    if (other.pos < op.pos) return { ...op, pos: op.pos - 1 };
    if (other.pos === op.pos) return { kind: "del", pos: -1 }; // already gone: a no-op
    return op;
  }
  return op;
}
const applyMaybe = (t: string, op: Op) => (op.kind === "del" && op.pos < 0 ? t : applyOp(t, op));

export type Run = { annLocal: string; benLocal: string; ann: string; ben: string; converged: boolean; annReceives: Op; benReceives: Op };

export function naive(s: Scenario): Run {
  const annLocal = applyOp(s.start, s.a);
  const benLocal = applyOp(s.start, s.b);
  const ann = applyOp(annLocal, s.b);
  const ben = applyOp(benLocal, s.a);
  return { annLocal, benLocal, ann, ben, converged: ann === ben, annReceives: s.b, benReceives: s.a };
}

export function ot(s: Scenario): Run {
  const annLocal = applyOp(s.start, s.a);
  const benLocal = applyOp(s.start, s.b);
  const annReceives = transform(s.b, s.a, false); // Ann's site wins ties
  const benReceives = transform(s.a, s.b, true);
  const ann = applyMaybe(annLocal, annReceives);
  const ben = applyMaybe(benLocal, benReceives);
  return { annLocal, benLocal, ann, ben, converged: ann === ben, annReceives, benReceives };
}

// A small RGA-style sequence CRDT. Each character has an id (counter, site) and
// remembers the id it was inserted after. Deleted characters stay as tombstones.
export type Id = { c: number; site: string };
export type Elem = { id: Id; after: Id | null; ch: string; deleted: boolean };
const idKey = (id: Id | null) => (id ? `${id.c}@${id.site}` : "root");
const later = (x: Id, y: Id) => x.c > y.c || (x.c === y.c && x.site > y.site);

export class Rga {
  elems: Elem[] = [];
  constructor(initial: string, site = "init") {
    let prev: Id | null = null;
    initial.split("").forEach((ch, i) => {
      const id = { c: i + 1, site };
      this.elems.push({ id, after: prev, ch, deleted: false });
      prev = id;
    });
  }
  clone(): Rga {
    const r = new Rga("");
    r.elems = this.elems.map((e) => ({ ...e }));
    return r;
  }
  visible(): Elem[] {
    return this.elems.filter((e) => !e.deleted);
  }
  text(): string {
    return this.visible().map((e) => e.ch).join("");
  }
  maxCounter(): number {
    return Math.max(0, ...this.elems.map((e) => e.id.c));
  }
  // Turn a position-based local edit into an id-based operation.
  local(op: Op, site: string): { kind: "ins"; elem: Elem } | { kind: "del"; id: Id } {
    const vis = this.visible();
    if (op.kind === "del") return { kind: "del", id: vis[op.pos].id };
    const after = op.pos === 0 ? null : vis[op.pos - 1].id;
    return { kind: "ins", elem: { id: { c: this.maxCounter() + 1, site }, after, ch: op.ch, deleted: false } };
  }
  integrate(o: { kind: "ins"; elem: Elem } | { kind: "del"; id: Id }) {
    if (o.kind === "del") {
      const e = this.elems.find((x) => idKey(x.id) === idKey(o.id));
      if (e) e.deleted = true;
      return;
    }
    // Insert right after its parent, but skip over concurrent siblings with later ids.
    let i = o.elem.after ? this.elems.findIndex((x) => idKey(x.id) === idKey(o.elem.after)) + 1 : 0;
    while (i < this.elems.length && idKey(this.elems[i].after) === idKey(o.elem.after) && later(this.elems[i].id, o.elem.id)) {
      // skip that sibling and everything inserted after it
      const skipFrom = this.elems[i].id;
      i++;
      while (i < this.elems.length && this.descends(this.elems[i], skipFrom)) i++;
    }
    this.elems.splice(i, 0, { ...o.elem });
  }
  private descends(e: Elem, ancestor: Id): boolean {
    let cur: Elem | undefined = e;
    while (cur && cur.after) {
      if (idKey(cur.after) === idKey(ancestor)) return true;
      const parentKey = idKey(cur.after);
      cur = this.elems.find((x) => idKey(x.id) === parentKey);
    }
    return false;
  }
}

export type CrdtRun = Run & { tombstones: number; metadataBytes: number; chars: { ch: string; id: string; deleted: boolean }[] };

export function crdt(s: Scenario): CrdtRun {
  const base = new Rga(s.start);
  const annDoc = base.clone();
  const benDoc = base.clone();
  const aOp = annDoc.local(s.a, "ann");
  annDoc.integrate(aOp);
  const bOp = benDoc.local(s.b, "ben");
  benDoc.integrate(bOp);
  const annLocal = annDoc.text();
  const benLocal = benDoc.text();
  annDoc.integrate(bOp);
  benDoc.integrate(aOp);
  const ann = annDoc.text();
  const ben = benDoc.text();
  const tombstones = annDoc.elems.filter((e) => e.deleted).length;
  return {
    annLocal,
    benLocal,
    ann,
    ben,
    converged: ann === ben,
    annReceives: s.b,
    benReceives: s.a,
    tombstones,
    metadataBytes: annDoc.elems.length * 16, // an id and a parent id per character, 8 bytes each
    chars: annDoc.elems.map((e) => ({ ch: e.ch, id: idKey(e.id), deleted: e.deleted })),
  };
}

export const opLabel = (op: Op) => (op.kind === "ins" ? `insert “${op.ch}” at ${op.pos}` : op.pos < 0 ? "nothing (already deleted)" : `delete at ${op.pos}`);
