"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Slider } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { EMPTY, HEADER, PAGE, POINTER, ROW_HEADER, apply, fit, rowBytes, used, type Op, type Page } from "@/lib/pagesHeap";

const ACCENT = "var(--db)";
const TABLE_ROWS = 1_000_000;
const STEP_FOR: Record<Op | "start", number> = { start: 0, insert: 3, update: 4, delete: 4, vacuum: 5 };
const OPS: { id: Op; label: string }[] = [
  { id: "insert", label: "INSERT" },
  { id: "update", label: "UPDATE oldest" },
  { id: "delete", label: "DELETE oldest" },
  { id: "vacuum", label: "VACUUM" },
];

function seed(data: number): Page {
  let p = EMPTY;
  for (let i = 0; i < 3; i++) p = apply(p, "insert", data).page;
  return p;
}

export default function PagesHeapDemo() {
  const [data, setData] = useState(600);
  const [page, setPage] = useState<Page>(() => seed(600));
  const [last, setLast] = useState<Op | "start">("start");
  const [msg, setMsg] = useState({ ok: true, text: "A page with three rows. Insert, update, delete and vacuum to see the bytes move.", touched: null as number | null });

  const u = used(page);
  const f = fit(data, TABLE_ROWS);
  const step = STEP_FOR[last];
  const rowLen = rowBytes(data);
  const tuples = [...page.slots].filter((s) => s.state !== "unused").sort((a, b) => b.n - a.n);
  const pct = (b: number) => `${(b / PAGE) * 100}%`;

  function run(op: Op) {
    const r = apply(page, op, data);
    setPage(r.page);
    setLast(op);
    setMsg({ ok: r.ok, text: r.text, touched: r.touched });
  }

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Pages, rows and the heap"
        blurb="A Postgres table is a file cut into 8 KB pages. Each page has a small header, a list of pointers at the front and the rows packed in from the back. Change the row size, then insert, update and delete, and watch the 8,192 bytes fill up."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="One 8 KB page">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">page 0 · 8,192 bytes</p>
              <div className="mt-2 flex h-14 w-full overflow-hidden rounded-md border border-[var(--line-strong)]" role="img" aria-label={`Header ${HEADER} bytes, ${page.slots.length} pointers, ${u.free} bytes free, ${tuples.length} rows`}>
                <span className="h-full shrink-0" style={{ width: pct(HEADER), minWidth: 3, background: "var(--faint)" }} title="page header" />
                <span className="h-full shrink-0" style={{ width: pct(u.pointers), minWidth: page.slots.length ? 3 : 0, background: "var(--c1)" }} title="line pointers" />
                <span className="grid h-full min-w-0 flex-1 place-items-center bg-[var(--track)] font-mono text-[10px] text-[var(--muted)]">{u.free > 600 ? `${u.free} free` : ""}</span>
                {tuples.map((t) => (
                  <span
                    key={t.n}
                    className="grid h-full shrink-0 place-items-center overflow-hidden border-l border-[var(--panel)] font-mono text-[10px]"
                    style={{
                      width: pct(t.len),
                      minWidth: 3,
                      background: t.state === "dead" ? "color-mix(in srgb, var(--bad) 45%, transparent)" : `color-mix(in srgb, ${ACCENT} ${msg.touched === t.n ? 85 : 45}%, transparent)`,
                      color: "var(--text)",
                    }}
                    title={`${t.label} (0,${t.n}) ${t.len} bytes ${t.state}`}
                  >
                    {t.len >= 400 ? t.n : ""}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
                <Key color="var(--faint)" text={`header ${HEADER} B`} />
                <Key color="var(--c1)" text={`pointers ${u.pointers} B`} />
                <Key color={`color-mix(in srgb, ${ACCENT} 45%, transparent)`} text={`live rows ${u.rows - u.dead} B`} />
                <Key color="color-mix(in srgb, var(--bad) 45%, transparent)" text={`dead rows ${u.dead} B`} />
                <Key color="var(--track)" text={`free ${u.free} B`} />
              </div>

              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">line pointers</p>
              <ol className="mt-1 grid grid-cols-2 gap-1 font-mono text-xs sm:grid-cols-3">
                {page.slots.map((s) => (
                  <li
                    key={s.n}
                    className="rounded px-2 py-1"
                    style={{
                      background: "var(--inset)",
                      outline: msg.touched === s.n ? `2px solid ${ACCENT}` : undefined,
                      color: s.state === "dead" ? "var(--bad)" : s.state === "unused" ? "var(--faint)" : undefined,
                    }}
                  >
                    (0,{s.n}) {s.state === "unused" ? "unused" : `${s.label} · ${s.state}`}
                  </li>
                ))}
              </ol>
            </section>
          }
          panel={
            <SystemMapPanel caption={<span style={{ color: msg.ok ? undefined : "var(--bad)" }}>{msg.text}</span>}>
              {OPS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => run(o.id)}
                  className="min-h-11 rounded-md border px-3 text-sm"
                  style={o.id === "insert" ? { background: ACCENT, borderColor: ACCENT, color: "var(--on-accent)", fontWeight: 600 } : { borderColor: "var(--line-strong)" }}
                >
                  {o.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPage(EMPTY);
                  setLast("start");
                  setMsg({ ok: true, text: "An empty page: just the 24-byte header.", touched: null });
                }}
                className="min-h-11 rounded-md px-3 text-sm text-[var(--muted)] underline"
              >
                Empty page
              </button>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Cut the table into 8 KB pages" what="The table is a file of fixed 8,192-byte pages. The database reads and writes whole pages, never single rows." accent={ACCENT} active={step === 0}>
                <Slider label="Data per row" accent={ACCENT} value={data} min={8} max={2000} step={8} format={(b) => `${b} B`} onChange={setData} hint="New rows use this size. Rows over about 2 KB get compressed or moved to a side table (TOAST)." />
                <p className="mt-2 text-sm">
                  <span className="font-mono">{f.per}</span> rows per page, so {TABLE_ROWS.toLocaleString()} rows take <span className="font-mono">{f.pages.toLocaleString()}</span> pages (
                  <span className="font-mono">{(f.bytes / 1024 / 1024).toFixed(0)} MB</span>).
                </p>
              </FlowStep>
              <FlowArrow label="one empty page" accent={ACCENT} />
              <FlowStep n={2} title="Start with a 24-byte header" what="The header records where free space starts and ends, plus a checksum and the log position of the page's last change." accent={ACCENT} active={page.slots.length === 0}>
                <p className="font-mono text-xs">free space: bytes {HEADER + u.pointers} to {PAGE - u.rows}</p>
              </FlowStep>
              <FlowArrow label="a row to store" accent={ACCENT} />
              <FlowStep n={3} title="Add a pointer at the front" what="Each row gets a 4-byte line pointer saying where on the page it sits. A row's address, its ctid, is (page, pointer number)." accent={ACCENT} active={step === 3}>
                <p className="font-mono text-xs">
                  {page.slots.length} pointers × {POINTER} B = {u.pointers} B
                </p>
              </FlowStep>
              <FlowArrow label="pointer → offset" accent={ACCENT} />
              <FlowStep n={4} title="Write the row from the back" what="The row itself goes at the end of the free space: a 23-byte header (who wrote it, who deleted it) padded to 24, then the data, padded to 8 bytes." accent={ACCENT} active={step === 3}>
                <p className="font-mono text-xs">
                  {ROW_HEADER} + {data} = {ROW_HEADER + data} → {rowLen} B on the page
                </p>
              </FlowStep>
              <FlowArrow label="a change to that row" accent={ACCENT} />
              <FlowStep n={5} title="Update and delete leave dead rows" what="An UPDATE writes a whole new copy of the row and marks the old one dead. A DELETE only marks it dead. Other transactions may still need the old copy." accent={ACCENT} active={step === 4}>
                <p className="font-mono text-xs" style={{ color: u.dead ? "var(--bad)" : undefined }}>
                  dead bytes on this page: {u.dead}
                </p>
              </FlowStep>
              <FlowArrow label="dead rows" accent={ACCENT} />
              <FlowStep n={6} title="Vacuum reclaims the space" what="VACUUM removes dead rows nobody can see any more and compacts the page. The freed space is reused by later inserts on this page; the file does not shrink." accent={ACCENT} active={step === 5}>
                <p className="font-mono text-xs">free now: {u.free} B</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Key({ color, text }: { color: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {text}
    </span>
  );
}
