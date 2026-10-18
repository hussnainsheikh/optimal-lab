"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { COMMENTS, DESIGNS, FEED_SIZE, MIXES, OPS, POSTS, POSTS_PER_AUTHOR, RISKS, STALENESS, USERS, perHundred, rows, type Design, type Op } from "@/lib/dataModeling";

const ACCENT = "var(--sys)";
const COLOR: Record<Design, string> = { normalized: "var(--c1)", denormalized: "var(--c4)", async: "var(--c3)" };

export default function DataModelingDemo() {
  const [design, setDesign] = useState<Design>("normalized");
  const [mixId, setMixId] = useState("readHeavy");
  const { stage, busy, run } = useWalk(5, 1100);
  const mix = MIXES.find((m) => m.id === mixId)!;
  const d = DESIGNS.find((x) => x.id === design)!;
  const at = (i: number) => stage === i;
  const totals = Object.fromEntries(DESIGNS.map((x) => [x.id, perHundred(x.id, mix)])) as Record<Design, ReturnType<typeof perHundred>>;
  const cheapest = DESIGNS.reduce((a, b) => (totals[b.id].total < totals[a.id].total ? b : a));
  const r = (op: Op) => rows(design, op);

  const captions = [
    `Step 1: ${USERS} users, ${POSTS} posts, ${COMMENTS} comments. The feed shows ${FEED_SIZE} posts with author names and comment counts.`,
    "Step 2: normalized, every fact lives once: the name in users, the count in comments.",
    `Step 3: a normalized feed touches ${rows("normalized", "feed").read} rows for ${FEED_SIZE} posts.`,
    `Step 4: with the name and count copied onto the post, the feed touches ${rows("denormalized", "feed").read} rows, and a rename rewrites ${rows("denormalized", "rename").write.toFixed(0)}.`,
    `Step 5: at ${mix.label.toLowerCase()}, ${cheapest.label.toLowerCase()} touches the fewest rows: ${Math.round(totals[cheapest.id].total)} per 100 operations.`,
  ];
  const caption =
    stage !== null
      ? captions[stage]
      : `${d.label}, ${mix.label.toLowerCase()}: ${Math.round(totals[design].total)} rows per 100 operations (${Math.round(totals[design].read)} reading, ${Math.round(totals[design].write)} writing). Stale for: ${STALENESS[design]}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Data modeling: normalize or denormalize"
        blurb="A blog's feed shows each post with its author's name and its comment count. Store each fact once and every feed read has to join and count. Copy the name and the count onto the post and the feed is one scan, but every rename and every comment has to update the copies. Count the rows under three workloads."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Rows touched per 100 operations by each design, and the schema of the chosen one">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">rows touched per 100 operations · {mix.label.toLowerCase()}</p>
              <ul className="mt-3 space-y-2">
                {DESIGNS.map((x) => {
                  const t = totals[x.id];
                  const max = Math.max(...DESIGNS.map((y) => totals[y.id].total));
                  return (
                    <li key={x.id} className="grid grid-cols-[7rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-xs sm:grid-cols-[12rem_minmax(0,1fr)_3.5rem]">
                      <span className="truncate" style={{ fontWeight: x.id === design ? 700 : 400 }}>
                        {x.label}
                      </span>
                      <span className="flex h-3 overflow-hidden rounded bg-[var(--track)]">
                        <span className="h-full" style={{ width: `${(t.read / max) * 100}%`, background: COLOR[x.id] }} title={`${Math.round(t.read)} rows read`} />
                        <span className="h-full opacity-50" style={{ width: `${(t.write / max) * 100}%`, background: COLOR[x.id] }} title={`${Math.round(t.write)} rows written`} />
                      </span>
                      <span className="text-right font-mono">{Math.round(t.total)}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1 text-[11px] text-[var(--muted)]">solid: reading · faded: writing</p>

              <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">schema · {d.label.toLowerCase()}</p>
              <Schema design={design} />
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Design" accent={ACCENT} value={design} onChange={setDesign} options={DESIGNS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Counting…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="List the entities and the questions" what="Users write posts; readers comment. The hot question is the feed: the newest posts with who wrote them and how many comments each has." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  {USERS} users · {POSTS} posts · {COMMENTS} comments · feed of {FEED_SIZE}
                </p>
              </FlowStep>
              <FlowArrow label="model it" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Normalize: each fact in one place" what="users(name), posts(author_id), comments(post_id). A rename is one row. A comment is one row. Nothing can disagree with itself." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">
                  rename: {rows("normalized", "rename").write} row · comment: {rows("normalized", "comment").write} row
                </p>
              </FlowStep>
              <FlowArrow label="read the feed" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Pay for it on every read" what="The feed joins each post to its author and counts its comments. Rows touched grow with comments per post, on the most-read page of the site." accent={ACCENT} active={at(2)}>
                <ul className="space-y-0.5 font-mono text-xs">
                  {rows("normalized", "feed").steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <p className="mt-1 font-mono text-xs">= {rows("normalized", "feed").read} rows per feed read</p>
              </FlowStep>
              <FlowArrow label="copy for reads" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Denormalize: copy what the read needs onto the row" what={`posts gains author_name and comment_count. The feed is ${rows("denormalized", "feed").read} rows. The copies have to be kept right: in the same transaction, or by a job that runs later.`} accent={ACCENT} active={at(3)}>
                <ul className="space-y-0.5 font-mono text-xs">
                  {(["comment", "rename"] as Op[]).map((op) => (
                    <li key={op}>
                      {OPS[op].label}: {r(op).steps.join("; ")}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-[var(--muted)]">{RISKS[design]}</p>
              </FlowStep>
              <FlowArrow label="your workload" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Decide by the read/write ratio" what={`Copies pay off when reads far outnumber writes to the copied fact, which is most feeds. With ${POSTS_PER_AUTHOR.toFixed(0)} posts per author a rename is cheap; with 10,000 it isn't. Keep the source normalized and treat the copy as a cache you can rebuild.`} accent={ACCENT} active={at(4)}>
                <Choices label="Workload" accent={ACCENT} value={mixId} onChange={setMixId} options={MIXES.map((m) => ({ id: m.id, label: m.label }))} />
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">rows/100 ops</span>
                  <span className="text-right text-[var(--faint)]">stale for</span>
                  {DESIGNS.map((x) => (
                    <Row key={x.id} label={x.label} total={Math.round(totals[x.id].total)} stale={STALENESS[x.id]} bold={x.id === design} />
                  ))}
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ label, total, stale, bold }: { label: string; total: number; stale: string; bold: boolean }) {
  const w = bold ? 700 : 400;
  return (
    <>
      <span className="font-sans" style={{ fontWeight: w }}>
        {label}
      </span>
      <span className="text-right" style={{ fontWeight: w }}>
        {total}
      </span>
      <span className="text-right" style={{ fontWeight: w }}>
        {stale}
      </span>
    </>
  );
}

function Schema({ design }: { design: Design }) {
  const copy = design !== "normalized";
  const tables = [
    { name: "users", cols: ["id", "name"] },
    { name: "posts", cols: ["id", "author_id", "title", ...(copy ? ["author_name ⟵ copy", "comment_count ⟵ copy"] : [])] },
    { name: "comments", cols: ["id", "post_id", "body"] },
  ];
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-3">
      {tables.map((t) => (
        <div key={t.name} className="rounded border border-[var(--line)] px-2 py-1.5 font-mono text-[11px]">
          <span className="block font-semibold">{t.name}</span>
          {t.cols.map((c) => (
            <span key={c} className="block" style={{ color: c.includes("⟵") ? COLOR[design] : "var(--muted)" }}>
              {c}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
