"use client";

import { useMemo, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { COLUMNS, GROUP, N, QUERIES, columnStore, orders, rowStore, runQuery, type Col, type Query, type Sort } from "@/lib/columnarStorage";

const ACCENT = "var(--db)";
const COL_COLOR: Record<Col, string> = { id: "var(--c1)", created_at: "var(--c2)", customer_id: "var(--c3)", country: "var(--c4)", status: "var(--c5)", amount_cents: "var(--db)", note: "var(--faint)" };

type Opts = { query: Query; sort: Sort };
const BY_TIME: Opts = { query: "lastWeek", sort: "created_at" };
const BY_COUNTRY: Opts = { query: "lastWeek", sort: "country" };

const bytes = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(2)} MB` : b >= 1e3 ? `${(b / 1e3).toFixed(1)} KB` : `${b} B`);
const QUERY_LABEL: Record<Query, string> = { lastWeek: "Last week by country", total: "Total revenue", byId: "One order by id", insert: "Insert one order" };

export default function ColumnarStorageDemo() {
  const [o, setO] = useState<Opts>(BY_TIME);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const rs = rowStore();
  const cs = columnStore(o.sort);
  const q = runQuery(o.query, o.sort);
  const all = useMemo(() => (Object.keys(QUERIES) as Query[]).map((k) => ({ k, r: runQuery(k, o.sort) })), [o.sort]);
  const sample = orders().slice(0, 4);
  const colWins = q.colBytes !== null && q.colBytes < q.rowBytes;
  const need = QUERIES[o.query].cols;

  const nodes: MapNode[] = [
    { id: "user", label: o.query === "insert" ? "Checkout" : o.query === "byId" ? "Order page" : "Analyst", sub: QUERY_LABEL[o.query], at: [12, 50], mobileAt: [50, 10], state: "active" },
    { id: "engine", label: "Query engine", sub: `${q.matches.toLocaleString("en-US")} row${q.matches === 1 ? "" : "s"} match`, at: [42, 50], mobileAt: [50, 38], state: "active" },
    { id: "row", label: "Row store", sub: `${bytes(q.rowBytes)} read`, at: [82, 22], mobileAt: [22, 75], state: colWins ? "bad" : "good" },
    { id: "col", label: "Column store", sub: q.colBytes === null ? `${q.chunksTouched} chunks to write` : `${bytes(q.colBytes)} read`, at: [82, 78], mobileAt: [78, 75], state: colWins ? "good" : "bad" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("r", ["engine", "row"], { label: `${rs.pages} pages` })
    : stage === 1 ? hops("c", ["engine", "col"], { label: `${COLUMNS.length} columns` })
    : stage === 2 ? hops("z", ["engine", "col"], { label: `${(cs.plain / cs.bytes).toFixed(1)}× smaller`, tone: "good" })
    : stage === 3 ? [...hops("qr", ["user", "engine", "row"], { label: bytes(q.rowBytes), tone: colWins ? "bad" : "good" }), ...hops("qc", ["user", "engine", "col"], { label: q.colBytes === null ? "7 chunks" : bytes(q.colBytes), tone: colWins ? "good" : "bad", start: 0.2 })]
    : stage === 4 ? hops("w", ["user", "engine", "row"], { label: "1 page", tone: "good" })
    : [];

  const captions = [
    `Step 1: the row store packs whole rows into 8 KB pages: ${Math.round(rs.avgRow)} bytes a row with its header, about ${Math.round(rs.rowsPerPage)} rows a page, ${rs.pages} pages.`,
    `Step 2: the column store keeps each column apart, in row groups of ${GROUP.toLocaleString("en-US")}: ${bytes(cs.plain)} before compression.`,
    `Step 3: each chunk holds one type of value, often repeated or in order, so it compresses: ${bytes(cs.plain)} → ${bytes(cs.bytes)} sorted by ${o.sort}.`,
    q.colBytes === null ? `Step 4: an insert adds one row to one heap page, but must touch all ${q.chunksTouched} column chunks.` : `Step 4: the row store reads ${bytes(q.rowBytes)}; the column store reads ${need.length} column${need.length === 1 ? "" : "s"} from ${q.groupsRead} of ${cs.groups} row groups: ${bytes(q.colBytes)}.`,
    "Step 5: a point lookup or a single insert favours rows; scanning a few columns over many rows favours columns. Many systems run both.",
  ];
  const caption = stage !== null ? captions[stage] : q.colBytes === null ? `${QUERY_LABEL[o.query]}: one heap page vs ${q.chunksTouched} column chunks.` : `${QUERY_LABEL[o.query]}: row store ${bytes(q.rowBytes)} vs column store ${bytes(q.colBytes)} (${q.groupsSkipped} of ${cs.groups} row groups skipped).`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Row vs columnar storage"
        blurb="A row store keeps each row's values together, which is ideal for reading or writing one order. A column store keeps each column's values together, so a query that sums one column over millions of rows reads just that column, compressed. Run four queries over 100,000 real generated orders and count the bytes each layout reads."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Queries go through a query engine to a row store or a column store holding the same orders"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "user", to: "engine", label: "SQL" },
                  { from: "engine", to: "row", label: "pages" },
                  { from: "engine", to: "col", label: "column chunks" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The same four orders in both layouts">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">The first 4 orders, laid out two ways · lit = read by this query</p>
                <p className="mt-3 text-[11px] text-[var(--muted)]">Row store: one row after another</p>
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {sample.flatMap((row, i) =>
                    COLUMNS.map((c) => (
                      <span key={`${i}-${c}`} title={`${c}: ${String(row[c] ?? "null")}`} className="h-4 w-3 rounded-sm" style={{ background: COL_COLOR[c], opacity: o.query === "insert" || o.query === "byId" ? (i === 0 ? 1 : 0.2) : 1 }} />
                    )),
                  )}
                </div>
                <p className="mt-3 text-[11px] text-[var(--muted)]">Column store: one column after another</p>
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {COLUMNS.flatMap((c) =>
                    sample.map((row, i) => (
                      <span key={`${c}-${i}`} title={`${c}: ${String(row[c] ?? "null")}`} className="h-4 w-3 rounded-sm" style={{ background: COL_COLOR[c], opacity: need.includes(c) ? 1 : 0.2 }} />
                    )),
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--muted)]">
                  {COLUMNS.map((c) => (
                    <span key={c} className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COL_COLOR[c] }} />{c}</span>
                  ))}
                </div>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices<Query> accent={ACCENT} value={o.query} onChange={(v) => set({ query: v })} options={(Object.keys(QUERIES) as Query[]).map((id) => ({ id, label: QUERY_LABEL[id] }))} />
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(BY_TIME)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Sorted by time
                </button>
                <button type="button" onClick={() => setO(BY_COUNTRY)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Sorted by country
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Scanning…">
                Run the query
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Rows on pages" what="A row store like Postgres writes each row's values side by side, with a 24-byte header and a 4-byte pointer, into 8 KB pages. Reading any value means reading the page with the whole row." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  {N.toLocaleString("en-US")} orders · {Math.round(rs.avgRow)} B a row · {Math.round(rs.rowsPerPage)} rows a page · {rs.pages} pages = {bytes(rs.bytes)}
                </p>
              </FlowStep>
              <FlowArrow label="same data, turned sideways" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Each column on its own" what="A column store such as ClickHouse, DuckDB or Parquet files writes all the ids together, all the countries together, and so on, in row groups. Each group records the min and max of every column." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">{cs.groups} row groups × {COLUMNS.length} columns = {cs.groups * COLUMNS.length} chunks · {bytes(cs.plain)} uncompressed</p>
              </FlowStep>
              <FlowArrow label="one type per chunk" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Compress each column chunk" what="A chunk of countries is a dozen distinct values: store a dictionary and a few bits each. Increasing ids and timestamps store small differences. Sorting the table changes which tricks work." accent={ACCENT} active={at(2)}>
                <Choices<Sort> accent={ACCENT} value={o.sort} onChange={(v) => set({ sort: v })} options={[{ id: "created_at", label: "Sorted by created_at" }, { id: "country", label: "Sorted by country" }]} />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[18rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 text-left font-normal">column</th>
                        <th className="py-1 text-left font-normal">encoding chosen</th>
                        <th className="py-1 text-right font-normal">plain</th>
                        <th className="py-1 text-right font-normal">stored</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {cs.perCol.map((c) => (
                        <tr key={c.col} className="border-t border-[var(--line)]">
                          <td className="py-1"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COL_COLOR[c.col] }} />{c.col}</td>
                          <td className="py-1 font-sans text-[var(--muted)]">{c.enc}</td>
                          <td className="py-1 text-right text-[var(--muted)]">{bytes(c.plain)}</td>
                          <td className="py-1 text-right">{bytes(c.bytes)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-[var(--line)] font-semibold">
                        <td className="py-1" colSpan={2}>total</td>
                        <td className="py-1 text-right">{bytes(cs.plain)}</td>
                        <td className="py-1 text-right">{bytes(cs.bytes)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </FlowStep>
              <FlowArrow label="run a query" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Read only what the query needs" what="The column store reads just the columns in the query, and skips any row group whose min/max can't match the filter. The row store has to read every page in a full scan." accent={ACCENT} active={at(3)}>
                <code className="block break-words font-mono text-[11px] text-[var(--muted)]">{QUERIES[o.query].sql}</code>
                <div className="space-y-1.5">
                  {[{ name: "Row store", b: q.rowBytes }, { name: "Column store", b: q.colBytes ?? 0 }].map((x) => (
                    <div key={x.name}>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[var(--muted)]">{x.name}</span>
                        <span className="font-mono">{q.colBytes === null && x.name === "Column store" ? `${q.chunksTouched} chunks touched` : bytes(x.b)}</span>
                      </div>
                      <div className="h-2 rounded bg-[var(--inset)]">
                        <div className="h-full rounded" style={{ width: `${Math.max(1, (x.b / Math.max(q.rowBytes, q.colBytes ?? 0)) * 100)}%`, background: ACCENT }} />
                      </div>
                    </div>
                  ))}
                </div>
                {q.colBytes !== null && <p className="text-[11px] text-[var(--muted)]">{q.groupsSkipped} of {cs.groups} row groups skipped by min/max</p>}
              </FlowStep>
              <FlowArrow label="the other side of the trade" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Pay for it on writes and point reads" what="Fetching one whole order means visiting every column. Inserting one order touches every column chunk, so column stores buffer inserts and write in big batches. Many teams keep Postgres for the app and copy data into a column store for analytics." accent={ACCENT} active={at(4)}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[17rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 text-left font-normal">query</th>
                        <th className="py-1 text-right font-normal">row store</th>
                        <th className="py-1 text-right font-normal">column store</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {all.map(({ k, r }) => {
                        const cw = r.colBytes !== null && r.colBytes < r.rowBytes;
                        return (
                          <tr key={k} className="border-t border-[var(--line)]">
                            <td className="py-1 font-sans text-[var(--muted)]">{QUERY_LABEL[k]}</td>
                            <td className="py-1 text-right" style={{ color: cw ? "var(--muted)" : "var(--good)" }}>{k === "insert" ? "1 page" : bytes(r.rowBytes)}</td>
                            <td className="py-1 text-right" style={{ color: cw ? "var(--good)" : "var(--muted)" }}>{r.colBytes === null ? `${r.chunksTouched} chunks` : bytes(r.colBytes)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Encodings, sizes and skipped groups are computed from the generated orders. A real table would be far bigger; the ratios hold.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
