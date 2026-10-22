"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { DAILY_USERS, DEEP_PAGES, ENDPOINTS, ERROR_CHECKS, ERROR_STYLES, EVOLUTIONS, INSERTS_PER_PAGE, OLD_APP_SHARE, PAGE, PAGES_READ, TABLE_ROWS, evolve, msFor, paginate, rowsTouched, type Change, type ErrorStyle, type Evolution, type Paging } from "@/lib/apiDesign";

const ACCENT = "var(--sys)";
const PAGINGS: { id: Paging; label: string }[] = [
  { id: "offset", label: "?offset=20&limit=10" },
  { id: "cursor", label: "?after=81&limit=10" },
];
const CHANGES: { id: Change; label: string }[] = [
  { id: "inserts", label: `${INSERTS_PER_PAGE} new orders per page read` },
  { id: "deletes", label: "2 read orders deleted per page" },
];

export default function ApiDesignDemo() {
  const [paging, setPaging] = useState<Paging>("offset");
  const [change, setChange] = useState<Change>("inserts");
  const [evo, setEvo] = useState<Evolution>("inPlace");
  const [err, setErr] = useState<ErrorStyle>("plain");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const p = paginate(paging, change);
  const other = paginate(paging === "offset" ? "cursor" : "offset", change);
  const ev = evolve(evo);
  const errStyle = ERROR_STYLES.find((e) => e.id === err)!;
  const passed = ERROR_CHECKS.filter((c) => c.pass[err]).length;

  const captions = [
    `Step 1: ${ENDPOINTS.length} endpoints on one resource, with the method saying what each does.`,
    `Step 2: ${PAGES_READ} pages of ${PAGE} while the list changes: ${p.dupes} duplicates and ${p.skipped} skipped with ${paging === "offset" ? "offsets" : "a cursor"}.`,
    `Step 3: page ${DEEP_PAGES[2].toLocaleString("en-US")} with OFFSET walks ${rowsTouched("offset", DEEP_PAGES[2]).toLocaleString("en-US")} index entries; with a cursor, ${rowsTouched("cursor", DEEP_PAGES[2])}.`,
    `Step 4: ${EVOLUTIONS.find((e) => e.id === evo)!.label.toLowerCase()}: ${ev.brokenUsers.toLocaleString("en-US")} users on old apps break.`,
    `Step 5: ${errStyle.label}: ${passed} of ${ERROR_CHECKS.length} things a client needs from an error.`,
  ];
  const caption = stage !== null ? captions[stage] : `Reading ${PAGES_READ} pages while ${change === "inserts" ? "new orders arrive" : "orders are deleted"}: ${p.dupes} duplicates and ${p.skipped} skipped with ${paging === "offset" ? "offset" : "cursor"} paging (${other.dupes} and ${other.skipped} with ${paging === "offset" ? "a cursor" : "offsets"}).`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="API design: pagination, versioning and errors"
        blurb="An orders API that strangers will build on. Name the resources, then the three decisions that are hardest to change later: how clients page through a list that changes under them, how a field changes without breaking apps nobody updates, and what an error tells the client."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label={`Five pages of orders read with ${paging} pagination, with duplicates and skipped orders marked`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">GET /orders{PAGINGS.find((x) => x.id === paging)!.label.replace(/^\?offset=20/, "?offset=n").replace(/after=81/, "after=<last id>")}</p>
                <p className="font-mono text-xs" style={{ color: p.dupes + p.skipped ? "var(--bad)" : "var(--good)" }}>
                  {p.dupes} dup · {p.skipped} skipped
                </p>
              </div>
              <ol className="mt-3 space-y-1.5">
                {p.pages.map((pg) => (
                  <li key={pg.page} className="flex items-center gap-2">
                    <span className="w-12 shrink-0 font-mono text-[11px] text-[var(--faint)]">page {pg.page}</span>
                    <span className="grid min-w-0 flex-1 grid-cols-10 gap-0.5">
                      {pg.ids.map((id) => {
                        const dup = pg.dupes.includes(id);
                        return (
                          <span key={id} className="flex h-6 items-center justify-center rounded border font-mono text-[9px] sm:text-[10px]" style={{ borderColor: dup ? "var(--bad)" : "var(--line-strong)", background: dup ? "color-mix(in srgb, var(--bad) 18%, transparent)" : "transparent", color: dup ? "var(--bad)" : "var(--text)" }}>
                            {id}
                          </span>
                        );
                      })}
                    </span>
                  </li>
                ))}
              </ol>
              {p.skipped > 0 && (
                <p className="mt-2 font-mono text-[11px]" style={{ color: "var(--bad)" }}>
                  never returned: {p.pages.flatMap((x) => x.skipped).join(", ")}
                </p>
              )}
              <p className="mt-2 text-[11px] text-[var(--muted)]">Newest first. Red: an order the client already had. Between requests: {CHANGES.find((c) => c.id === change)!.label}.</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Paging" accent={ACCENT} value={paging} onChange={setPaging} options={PAGINGS.map((x) => ({ id: x.id, label: x.id === "offset" ? "Offset" : "Cursor" }))} />
              </div>
              <div className="w-full">
                <Choices label="While reading" accent={ACCENT} value={change} onChange={setChange} options={CHANGES} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Walking…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Name resources, let methods say what happens" what="Nouns in the path, verbs from HTTP. GET is safe to repeat and cache; PUT and DELETE are idempotent, so a retry is harmless; POST isn't, so it takes an idempotency key." accent={ACCENT} active={at(0)}>
                <ul className="space-y-0.5 font-mono text-[11px]">
                  {ENDPOINTS.map((e) => (
                    <li key={e.method + e.path} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-2">
                      <span style={{ color: e.safe ? "var(--good)" : e.idempotent ? "var(--text)" : "var(--bad)" }}>{e.method}</span>
                      <span className="min-w-0 break-words">
                        {e.path} <span className="text-[var(--faint)]">· {e.does}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[11px] text-[var(--muted)]">green: safe · white: idempotent · red: neither</p>
              </FlowStep>
              <FlowArrow label="a long list" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Page with a cursor, not an offset" what="An offset counts positions in a list that keeps moving. New orders push old ones down and the next page repeats them; deletes pull them up and the next page skips them. A cursor says “after this id”, which doesn't move." accent={ACCENT} active={at(1)}>
                <Choices label="Paging" accent={ACCENT} value={paging} onChange={setPaging} options={PAGINGS} />
                <p className="mt-2 font-mono text-xs">
                  {PAGINGS.map((x) => {
                    const r = paginate(x.id, change);
                    return `${x.id}: ${r.seen} distinct of ${PAGES_READ * PAGE}, ${r.dupes} dup, ${r.skipped} skipped`;
                  }).join(" · ")}
                </p>
              </FlowStep>
              <FlowArrow label="deep pages" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Make deep pages cheap" what={`OFFSET n makes the database walk past n rows to throw them away, so page 10,000 of a ${(TABLE_ROWS / 1e6).toFixed(0)}-million-row table costs a thousand times page 10. WHERE id < cursor seeks straight to the spot through the index.`} accent={ACCENT} active={at(2)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span className="text-[var(--faint)]">page</span>
                  <span className="text-right text-[var(--faint)]">offset</span>
                  <span className="text-right text-[var(--faint)]">cursor</span>
                  {DEEP_PAGES.map((pg) => (
                    <Row key={pg} cells={[pg.toLocaleString("en-US"), `${rowsTouched("offset", pg).toLocaleString("en-US")} rows · ${msFor(rowsTouched("offset", pg)).toFixed(1)} ms`, `${rowsTouched("cursor", pg)} rows · ${msFor(rowsTouched("cursor", pg)).toFixed(1)} ms`]} bad={rowsTouched("offset", pg) > 10000} />
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-[var(--faint)]">Rows are exact for the two queries; milliseconds assume half a microsecond per index entry, so treat them as a shape, not a benchmark.</p>
              </FlowStep>
              <FlowArrow label="the API changes" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Change a field without breaking old clients" what={`Rename total to amount. Web clients update today; ${Math.round(OLD_APP_SHARE * 100)}% of mobile users run an app from months ago. Removing or renaming breaks them; adding never does. So add first, announce a deprecation date, watch usage of the old field fall to zero, then remove it.`} accent={ACCENT} active={at(3)}>
                <Choices label="How" accent={ACCENT} value={evo} onChange={setEvo} options={EVOLUTIONS.map((e) => ({ id: e.id, label: e.label }))} />
                <p className="mt-2 text-xs">{EVOLUTIONS.find((e) => e.id === evo)!.one}</p>
                <p className="mt-1 font-mono text-xs" style={{ color: ev.brokenUsers ? "var(--bad)" : "var(--good)" }}>
                  {ev.brokenUsers.toLocaleString("en-US")} of {DAILY_USERS.toLocaleString("en-US")} daily users broken · {ev.versionsToRun} version{ev.versionsToRun === 1 ? "" : "s"} to run{ev.bytesExtra ? ` · +${ev.bytesExtra} bytes an order while both fields exist` : ""}
                </p>
              </FlowStep>
              <FlowArrow label="when it goes wrong" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Return errors a client can act on" what="The status code says whose fault it is and whether a retry can help. A machine-readable type lets code branch. A pointer to each bad field lets a form highlight it. RFC 9457 Problem Details is the standard shape." accent={ACCENT} active={at(4)}>
                <Choices label="Response" accent={ACCENT} value={err} onChange={setErr} options={ERROR_STYLES.map((e) => ({ id: e.id, label: e.label }))} />
                <pre className="mt-2 overflow-x-auto rounded bg-[var(--inset)] px-2 py-1.5 font-mono text-[11px] leading-snug">{`HTTP/1.1 ${errStyle.status}\n\n${errStyle.body}`}</pre>
                <ul className="mt-2 space-y-0.5 text-xs">
                  {ERROR_CHECKS.map((c) => (
                    <li key={c.label} style={{ color: c.pass[err] ? "var(--good)" : "var(--muted)" }}>
                      {c.pass[err] ? "✓" : "✗"} {c.label}
                    </li>
                  ))}
                </ul>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, bad }: { cells: string[]; bad?: boolean }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "" : "text-right"} style={{ color: bad && i === 1 ? "var(--bad)" : "var(--text)" }}>
          {c}
        </span>
      ))}
    </>
  );
}
