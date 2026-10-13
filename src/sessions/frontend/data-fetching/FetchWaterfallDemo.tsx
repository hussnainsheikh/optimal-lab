"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { bars, MODES, type Mode } from "@/lib/fetchWaterfall";

const ACCENT = "var(--web)";
const SPAN = 650;

export default function FetchWaterfallDemo() {
  const [m, setM] = useState<Mode>("waterfall");
  const b = bars(m);
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Data fetching without waterfalls" blurb="A profile page needs the user, then their posts, then the posts' comments, plus an unrelated sidebar. If each component fetches only after its parent has rendered, requests line up one behind another. Each request here is a 120 ms round trip plus 30 ms of work." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Requests over time">
              <ul className="space-y-1.5">{b.rows.map((r) => <li key={r.name} className="grid grid-cols-[5rem_minmax(0,1fr)_4rem] items-center gap-2 text-xs"><span className="font-mono">{r.name}</span><span className="relative h-4 rounded bg-[var(--track)]"><span className="absolute inset-y-0 rounded" style={{ left: `${(r.start / SPAN) * 100}%`, width: `${((r.end - r.start) / SPAN) * 100}%`, background: ACCENT }} /></span><span className="text-right font-mono">{r.end} ms</span></li>)}</ul>
              <p className="mt-3 font-mono text-sm">page complete at <b style={{ color: ACCENT }}>{b.done} ms</b></p>
            </section>
          }
          panel={<SystemMapPanel caption={m === "waterfall" ? "The sidebar waits for the user even though it doesn't need it, and every step also waits for a render. Three round trips in a row, plus render gaps." : m === "parallel" ? "The user and sidebar start at once. Posts and comments truly depend on earlier results, so they still wait, but nothing waits needlessly." : "On the server, each query is a 2 ms hop to the database instead of a 120 ms trip from the phone. One round trip delivers the finished page."}><Choices label="Strategy" accent={ACCENT} value={m} onChange={setM} options={MODES} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Fetch-on-render makes waterfalls" what="A child can't start fetching until its parent has loaded and rendered it." accent={ACCENT} active={m === "waterfall"}><p className="text-sm text-[var(--muted)]">Spot them in the Network panel as staircases.</p></FlowStep>
              <FlowArrow label="start early" accent={ACCENT} />
              <FlowStep n={2} title="Kick off independent requests together" what="Hoist fetching to the route level and run unrelated requests in parallel." accent={ACCENT} active={m === "parallel"}><p className="font-mono text-xs">await Promise.all([getUser(), getSidebar()])</p></FlowStep>
              <FlowArrow label="move closer" accent={ACCENT} />
              <FlowStep n={3} title="Fetch on the server" what="Server components and loaders query next to the database; dependent requests become cheap." accent={ACCENT} active={m === "server"}><p className="text-sm text-[var(--muted)]">Or one API endpoint shaped for the page.</p></FlowStep>
              <FlowArrow label="then" accent={ACCENT} />
              <FlowStep n={4} title="Cache and dedupe" what="Libraries like TanStack Query share results between components and refetch smartly." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Stream slow parts with Suspense.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
