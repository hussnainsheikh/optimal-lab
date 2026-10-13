"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { cost, PKGS } from "@/lib/affectedBuilds";

const ACCENT = "var(--ops)";

export default function AffectedDemo() {
  const [changed, setChanged] = useState("ui");
  const [mode, setMode] = useState<"all" | "affected" | "cached">("affected");
  const rows = cost(changed, mode);
  const secs = rows.filter((r) => r.runs && !r.restored).reduce((a, r) => a + r.secs, 0);
  const total = PKGS.reduce((a, p) => a + p.secs, 0);
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Build caching in CI" blurb="A monorepo has five packages. Rebuilding and testing all of them on every commit is slow. A build tool that knows the dependency graph only rebuilds what a change can affect, and restores everything else from a cache." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Packages">
              <ul className="space-y-1.5">
                {rows.map((r) => (
                  <li key={r.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)_6rem] items-center gap-2 text-sm">
                    <span className="font-mono" style={{ color: r.id === changed ? ACCENT : undefined }}>{r.id}</span>
                    <span className="text-[11px] text-[var(--muted)]">{r.deps.length ? `depends on ${r.deps.join(", ")}` : "no internal deps"}</span>
                    <span className="text-right font-mono text-xs" style={{ color: r.runs && !r.restored ? "var(--auto)" : "var(--good)" }}>{r.restored ? "cache hit" : r.runs ? `build ${r.secs}s` : "skipped"}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 font-mono text-sm">CI time: <span style={{ color: ACCENT }}>{Math.floor(secs / 60)}m {secs % 60}s</span> <span className="text-[var(--faint)]">(everything: {Math.floor(total / 60)}m {total % 60}s)</span></p>
            </section>
          }
          panel={
            <SystemMapPanel caption={mode === "all" ? "Every package rebuilds on every commit, however small." : `Changing ${changed} affects ${rows.filter((r) => r.runs && !r.restored).map((r) => r.id).join(", ")}, because they import it. ${mode === "cached" ? "The rest are restored from the remote cache, so their tests still count as passed." : "The rest are skipped."}`}>
              <Choices label="You changed" accent={ACCENT} value={changed} onChange={setChanged} options={PKGS.map((p) => ({ id: p.id, label: p.id }))} />
              <Choices label="CI runs" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "all", label: "Everything" }, { id: "affected", label: "Affected only" }, { id: "cached", label: "Affected + remote cache" }]} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Know the graph" what="Build tools read which packages import which, so they know what a change can break." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Turborepo, Nx, Bazel, Pants.</p></FlowStep>
              <FlowArrow label="change" accent={ACCENT} />
              <FlowStep n={2} title="Rebuild the affected set" what="The changed package plus everything that depends on it, directly or indirectly." accent={ACCENT} active={mode !== "all"}><p className="font-mono text-xs">turbo run test --filter=...[origin/main]</p></FlowStep>
              <FlowArrow label="share results" accent={ACCENT} />
              <FlowStep n={3} title="Cache outputs by input hash" what="Hash a task's inputs; if anyone has built it before, download the outputs instead of rebuilding." accent={ACCENT} active={mode === "cached"}><p className="text-sm text-[var(--muted)]">Shared across CI runs and laptops.</p></FlowStep>
              <FlowArrow label="also" accent={ACCENT} />
              <FlowStep n={4} title="Cache dependencies too" what="Key the package cache on the lockfile hash; parallelise independent jobs." accent={ACCENT}><p className="font-mono text-xs">key: deps-${"{{"} hashFiles(&apos;pnpm-lock.yaml&apos;) {"}}"}</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
