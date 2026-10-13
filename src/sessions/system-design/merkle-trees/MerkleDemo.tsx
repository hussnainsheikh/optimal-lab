"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { compare, DIFFS, type Diff } from "@/lib/merkle";

const ACCENT = "var(--sys)";

export default function MerkleDemo() {
  const [d, setD] = useState<Diff>("one");
  const r = compare(d);
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Merkle trees: find what's different" blurb="Two replicas each hold 8 blocks. Instead of sending every block to compare, each builds a tree of hashes: leaves hash the blocks, parents hash their children. Compare roots, and only walk down where hashes differ." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Two hash trees">
              {[["Replica A", r.A], ["Replica B", r.B]].map(([label, levels], ti) => (
                <div key={String(label)} className="mt-4 first:mt-0">
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">{String(label)}</p>
                  {(levels as string[][]).map((row, lvl) => (
                    <div key={lvl} className="mt-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
                      {row.map((hash, i) => {
                        const key = `${lvl}-${i}`; const diff = r.differs.includes(key); const checked = r.checked.includes(key);
                        return <span key={i} className="rounded py-1 text-center font-mono text-[10px]" style={{ background: diff ? "var(--bad)" : checked ? "var(--inset)" : "transparent", color: diff ? "var(--on-accent)" : checked ? undefined : "var(--faint)", border: checked ? "none" : "1px dashed var(--line)" }}>{hash}</span>;
                      })}
                    </div>
                  ))}
                  <div className="mt-1 grid grid-cols-8 gap-1">{(ti === 0 ? ["alice", "bob", "carol", "dave", "erin", "frank", "grace", "heidi"] : r.replicaB).map((b, i) => <span key={i} className="truncate text-center text-[10px] text-[var(--muted)]" style={{ color: ti === 1 && r.bad.includes(i) ? "var(--bad)" : undefined }}>{b}</span>)}</div>
                </div>
              ))}
              <p className="mt-4 font-mono text-sm">compared {r.checked.length} hashes · blocks to sync: {r.bad.length ? r.bad.map((i) => i + 1).join(", ") : "none"}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">Dashed: never compared. With a million blocks and one difference, about 40 comparisons instead of a million.</p>
            </section>
          }
          panel={<SystemMapPanel caption={d === "none" ? "Roots match, so every block matches. One comparison and done." : `Roots differ. Follow only the mismatched branches down to block${r.bad.length > 1 ? "s" : ""} ${r.bad.map((i) => i + 1).join(" and ")}.`}><Choices label="Replica B" accent={ACCENT} value={d} onChange={setD} options={DIFFS} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Hash the blocks" what="Each leaf is the hash of one block of data." accent={ACCENT}><p className="font-mono text-xs">leaf = hash(block)</p></FlowStep>
              <FlowArrow label="pair upward" accent={ACCENT} />
              <FlowStep n={2} title="Hash pairs up to a root" what="Each parent hashes its two children. The root summarises everything: change any byte and the root changes." accent={ACCENT}><p className="font-mono text-xs">parent = hash(left + right)</p></FlowStep>
              <FlowArrow label="compare" accent={ACCENT} />
              <FlowStep n={3} title="Walk down only where it differs" what="Matching subtrees are skipped entirely. Work grows with the number of differences × log n." accent={ACCENT} active={d !== "none"}><p className="text-sm text-[var(--muted)]">Red: hashes that differ.</p></FlowStep>
              <FlowArrow label="used by" accent={ACCENT} />
              <FlowStep n={4} title="Where you meet them" what="Cassandra and DynamoDB repair replicas this way; Git and blockchains prove content; certificate transparency logs prove inclusion." accent={ACCENT}><p className="text-sm text-[var(--muted)]">A short path of hashes proves one block is in the tree.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
