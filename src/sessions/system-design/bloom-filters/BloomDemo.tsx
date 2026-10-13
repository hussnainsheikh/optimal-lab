"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { ADDED, K, M, bits, check, fpRate, positions } from "@/lib/bloomFilter";

const ACCENT = "var(--sys)";
const QUERIES = ["alice", "zoe", "peggy", "erin"];

export default function BloomDemo() {
  const [count, setCount] = useState(ADDED.length);
  const [q, setQ] = useState("zoe");
  const items = ADDED.slice(0, count);
  const b = bits(items);
  const r = check(q, items);
  const verdict = !r.maybe ? "Definitely not added" : r.really ? "Probably added (and it was)" : "Probably added, but it wasn't: a false positive";

  return (
    <SessionPage>
      <SessionHeader kicker="System Design · interactive" title="Bloom filters" blurb={`A Bloom filter answers “have I seen this?” using a few bits per item instead of storing the items. It can say “no” for sure, and “probably yes” with a small chance of being wrong. ${M} bits, ${K} hash functions.`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The bit array">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{M} bits · {b.filter(Boolean).length} set</p>
              <ol className="mt-3 grid grid-cols-12 gap-1">
                {b.map((on, i) => {
                  const probed = r.pos.includes(i);
                  return (
                    <li key={i} className="flex flex-col items-center">
                      <span className="grid h-8 w-full place-items-center rounded border font-mono text-sm" style={{ borderColor: probed ? (on ? "var(--good)" : "var(--bad)") : "var(--line)", background: on ? "color-mix(in srgb, var(--sys) 30%, transparent)" : "var(--inset)", borderWidth: probed ? 2 : 1 }}>{on ? 1 : 0}</span>
                      <span className="font-mono text-[9px] text-[var(--faint)]">{i}</span>
                    </li>
                  );
                })}
              </ol>
              <ul className="mt-4 flex flex-wrap gap-2 text-xs">
                {items.map((it) => (
                  <li key={it} className="rounded border border-[var(--line)] bg-[var(--inset)] px-2 py-1 font-mono">{it} → {positions(it).join(", ")}</li>
                ))}
              </ul>
              <div className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: r.falsePositive ? "var(--bad)" : r.maybe ? "var(--good)" : "var(--line-strong)" }}>
                <p className="font-mono">check(&quot;{q}&quot;) → bits {r.pos.join(", ")}: {r.pos.map((p) => (b[p] ? 1 : 0)).join(", ")}</p>
                <p className="mt-1" style={{ color: r.falsePositive ? "var(--bad)" : undefined }}>{verdict}</p>
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={verdict}>
              <Choices label="Check a name" accent={ACCENT} value={q} onChange={setQ} options={QUERIES.map((x) => ({ id: x, label: x }))} />
              <Choices label="Names added" accent={ACCENT} value={String(count)} onChange={(v) => setCount(Number(v))} options={[1, 3, 5].map((n) => ({ id: String(n), label: String(n) }))} />
              <p className="w-full text-xs text-[var(--muted)]">Expected false-positive rate with {count}: {(fpRate(count) * 100).toFixed(1)}%</p>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Adding sets a few bits" what={`Each item is hashed ${K} ways; each hash picks a bit to set to 1. The item itself isn't stored.`} accent={ACCENT}>
                <p className="font-mono text-sm">{items.length} items added</p>
              </FlowStep>
              <FlowArrow label="later, a lookup" accent={ACCENT} />
              <FlowStep n={2} title="Checking reads the same bits" what="Hash the item the same way and look at those bits." accent={ACCENT} active>
                <p className="font-mono text-sm">bits {r.pos.join(", ")}</p>
              </FlowStep>
              <FlowArrow label="any zero?" accent={ACCENT} />
              <FlowStep n={3} title="Any 0 means “definitely not”" what="If the item had been added, all its bits would be 1. One zero proves it wasn't. This is the useful answer: skip the expensive lookup." accent={ACCENT} active={!r.maybe}>
                <p className="text-sm">{!r.maybe ? `${q} was never added. No database query needed.` : "All bits are 1 here."}</p>
              </FlowStep>
              <FlowArrow label="all ones" accent={ACCENT} />
              <FlowStep n={4} title="All 1s means “probably”" what="Other items may have set those bits. More items, or fewer bits, means more false positives. Size the filter for the error rate you can live with." accent={ACCENT} active={r.maybe}>
                <p className="text-sm" style={{ color: r.falsePositive ? "var(--bad)" : undefined }}>{r.falsePositive ? `${q} was never added, but its bits were all set by others.` : r.maybe ? "Confirm with the real store when it matters." : "—"}</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
