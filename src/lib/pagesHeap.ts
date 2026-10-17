// One 8 KB heap page in the PostgreSQL layout. The page header takes 24 bytes; line
// pointers (4 bytes each) grow from the front, row data grows from the back, and the gap
// in between is free space. Every row carries a 23-byte header, padded to 24, and the
// whole row is padded to a multiple of 8 bytes.

export const PAGE = 8192;
export const HEADER = 24;
export const POINTER = 4;
export const ROW_HEADER = 24;
export const MAX_ROWS_PER_PAGE = 291; // PostgreSQL's MaxHeapTuplesPerPage for 8 KB pages

export const align8 = (n: number) => Math.ceil(n / 8) * 8;
export const rowBytes = (data: number) => align8(ROW_HEADER + data);

/** How many rows of this data width fit on one page, and the table size for `rows`. */
export function fit(data: number, rows: number) {
  const per = Math.min(MAX_ROWS_PER_PAGE, Math.floor((PAGE - HEADER) / (POINTER + rowBytes(data))));
  const pages = Math.ceil(rows / per);
  return { per, pages, bytes: pages * PAGE };
}

export type Slot = {
  /** Line pointer number, 1-based: the second half of the row's ctid. */
  n: number;
  label: string;
  state: "live" | "dead" | "unused";
  len: number;
};

export type Page = { slots: Slot[]; nextId: number };

export const EMPTY: Page = { slots: [], nextId: 1 };

export function used(p: Page) {
  const pointers = p.slots.length * POINTER;
  const rows = p.slots.reduce((s, x) => s + (x.state === "unused" ? 0 : x.len), 0);
  const dead = p.slots.reduce((s, x) => s + (x.state === "dead" ? x.len : 0), 0);
  return { pointers, rows, dead, free: PAGE - HEADER - pointers - rows };
}

export type Op = "insert" | "update" | "delete" | "vacuum";
export type Result = { page: Page; ok: boolean; text: string; touched: number | null };

function place(p: Page, label: string, len: number): { page: Page; n: number } | null {
  const reuse = p.slots.find((s) => s.state === "unused");
  const need = len + (reuse ? 0 : POINTER);
  if (used(p).free < need) return null;
  if (reuse) {
    return { page: { ...p, slots: p.slots.map((s) => (s.n === reuse.n ? { ...s, label, state: "live", len } : s)) }, n: reuse.n };
  }
  const n = p.slots.length + 1;
  return { page: { ...p, slots: [...p.slots, { n, label, state: "live", len }] }, n };
}

export function apply(p: Page, op: Op, data: number): Result {
  const len = rowBytes(data);
  const firstLive = p.slots.find((s) => s.state === "live");
  switch (op) {
    case "insert": {
      const label = `row ${p.nextId}`;
      const r = place(p, label, len);
      if (!r) return { page: p, ok: false, touched: null, text: `Page full: ${used(p).free} bytes free, ${len + POINTER} needed. The row goes to the next page.` };
      return { page: { ...r.page, nextId: p.nextId + 1 }, ok: true, touched: r.n, text: `${label} stored at (0,${r.n}): ${len} bytes of row plus a 4-byte pointer.` };
    }
    case "update": {
      if (!firstLive) return { page: p, ok: false, touched: null, text: "No live row to update." };
      const label = firstLive.label.includes("′") ? firstLive.label : `${firstLive.label}′`;
      const marked: Page = { ...p, slots: p.slots.map((s) => (s.n === firstLive.n ? { ...s, state: "dead" } : s)) };
      const r = place(marked, label, len);
      if (!r) return { page: p, ok: false, touched: null, text: "No room for the new version on this page, so it would go to another page and every index would need a new entry." };
      return { page: r.page, ok: true, touched: r.n, text: `UPDATE wrote a new copy at (0,${r.n}). The old copy at (0,${firstLive.n}) is now dead but still takes ${firstLive.len} bytes.` };
    }
    case "delete": {
      if (!firstLive) return { page: p, ok: false, touched: null, text: "No live row to delete." };
      return {
        page: { ...p, slots: p.slots.map((s) => (s.n === firstLive.n ? { ...s, state: "dead" } : s)) },
        ok: true,
        touched: firstLive.n,
        text: `DELETE only marked (0,${firstLive.n}) dead. Its ${firstLive.len} bytes stay until vacuum.`,
      };
    }
    case "vacuum": {
      const dead = p.slots.filter((s) => s.state === "dead");
      if (!dead.length) return { page: p, ok: true, touched: null, text: "Nothing to clean: no dead rows." };
      const freed = dead.reduce((s, x) => s + x.len, 0);
      return {
        page: { ...p, slots: p.slots.map((s) => (s.state === "dead" ? { ...s, state: "unused", len: 0, label: "" } : s)) },
        ok: true,
        touched: null,
        text: `VACUUM freed ${freed} bytes from ${dead.length} dead ${dead.length === 1 ? "row" : "rows"}. Their pointers stay and get reused by the next insert.`,
      };
    }
  }
}
