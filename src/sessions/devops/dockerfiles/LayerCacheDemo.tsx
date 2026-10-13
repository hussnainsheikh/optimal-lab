"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { build, type Change, type Order } from "@/lib/dockerLayerCache";

const ACCENT = "var(--ops)";

export default function LayerCacheDemo() {
  const [o, setO] = useState<Order>("bad");
  const [c, setC] = useState<Change>("code");
  const b = build(o, c);
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Writing Dockerfiles that cache well" blurb="Each instruction is a cached layer. When a layer's inputs change, it and every layer after it rebuild. Copying all your code before installing dependencies means a one-line code change reinstalls everything." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Build output">
              <ol className="space-y-1 font-mono text-xs">{b.rows.map((r, i) => <li key={i} className="flex justify-between gap-2 rounded px-2 py-1.5" style={{ background: "var(--inset)", borderLeft: `3px solid ${r.cached ? "var(--good)" : "var(--bad)"}` }}><span>{r.line}</span><span style={{ color: r.cached ? "var(--good)" : "var(--bad)" }}>{r.cached ? "CACHED" : `${r.secs}s`}</span></li>)}</ol>
              <p className="mt-3 font-mono text-sm" style={{ color: b.secs > 30 ? "var(--bad)" : "var(--good)" }}>rebuild: {b.secs} s</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={c === "none" ? "Nothing changed, so every layer comes from cache." : o === "bad" && c === "code" ? "COPY . . changed, so npm ci reruns: 45 s of reinstalling dependencies you didn't touch." : o === "good" && c === "code" ? "package.json didn't change, so npm ci is cached. Only the code copy and build rerun." : "Dependencies really changed, so reinstalling is correct."}>
              <Choices label="Dockerfile" accent={ACCENT} value={o} onChange={setO} options={[{ id: "bad", label: "Copy everything first" }, { id: "good", label: "Dependencies first" }]} />
              <Choices label="You changed" accent={ACCENT} value={c} onChange={setC} options={[{ id: "code", label: "A source file" }, { id: "deps", label: "package.json" }, { id: "none", label: "Nothing" }]} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Layers cache in order" what="A changed layer invalidates everything after it, so order from least to most frequently changing." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Base image, OS packages, dependencies, then code.</p></FlowStep>
              <FlowArrow label="the trick" accent={ACCENT} />
              <FlowStep n={2} title="Copy the lockfile first" what="Install dependencies from package files alone, then copy the rest. Code edits skip the slow install." accent={ACCENT} active={o === "good"}><p className="text-sm text-[var(--muted)]">Same for pip, go mod, cargo.</p></FlowStep>
              <FlowArrow label="smaller" accent={ACCENT} />
              <FlowStep n={3} title="Multi-stage builds" what="Build in a full image, then copy only the output into a slim runtime image: no compilers or dev dependencies shipped." accent={ACCENT}><p className="font-mono text-xs">FROM node:22 AS build … FROM node:22-slim</p></FlowStep>
              <FlowArrow label="hygiene" accent={ACCENT} />
              <FlowStep n={4} title=".dockerignore, pinned bases, non-root user" what="Keep node_modules and .git out of the context, pin image versions, and add USER node." accent={ACCENT}><p className="text-sm text-[var(--muted)]">In CI, cache layers between runs too.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
