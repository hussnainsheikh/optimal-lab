"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { RES, result, VISITS } from "@/lib/httpCache";

const ACCENT = "var(--web)";
const COLOR = { network: "var(--auto)", cache: "var(--good)", "304": "var(--c4)" } as const;

export default function HttpCacheDemo() {
  const [v, setV] = useState("1");
  const rows = RES.map((r) => ({ ...r, ...result(r.kind, Number(v)) }));
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="HTTP caching" blurb="Response headers tell the browser how long it may reuse a file without asking, and how to ask cheaply when it must check. Get them right and repeat visits load almost nothing; get them wrong and users see stale code after a deploy." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Resources">
              <ul className="space-y-2">{rows.map((r) => <li key={r.name} className="rounded-lg border border-[var(--line)] p-2"><p className="flex justify-between gap-2 text-sm"><span className="font-mono">{r.name}</span><span className="rounded px-2 font-mono text-xs" style={{ background: COLOR[r.how as keyof typeof COLOR], color: "var(--on-accent)" }}>{r.how === "cache" ? "from cache" : r.how === "304" ? "304" : "network"}</span></p><p className="font-mono text-[11px] text-[var(--muted)]">Cache-Control: {r.header}</p><p className="mt-1 text-xs">{r.note}</p></li>)}</ul>
            </section>
          }
          panel={<SystemMapPanel caption={v === "3" ? "Because the HTML is always revalidated and the JS filename contains a content hash, users get the new version immediately while unchanged files stay cached." : "Hashed assets never hit the network again; the HTML costs one tiny 304; the API is always live."}><Choices label="Visit" accent={ACCENT} value={v} onChange={setV} options={VISITS.map((x, i) => ({ id: String(i), label: x }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Fingerprint and cache forever" what="Put a content hash in asset filenames and cache them for a year, immutable. A change makes a new name." accent={ACCENT}><p className="font-mono text-xs">max-age=31536000, immutable</p></FlowStep>
              <FlowArrow label="the entry point" accent={ACCENT} />
              <FlowStep n={2} title="Always revalidate HTML" what="no-cache means “check before using”. With an ETag, unchanged pages cost a 304 with no body." accent={ACCENT} active={v !== "0"}><p className="text-sm text-[var(--muted)]">no-cache ≠ no-store.</p></FlowStep>
              <FlowArrow label="private data" accent={ACCENT} />
              <FlowStep n={3} title="no-store and private" what="Personal or sensitive responses shouldn't sit in shared caches, or any cache." accent={ACCENT}><p className="text-sm text-[var(--muted)]">CDNs honour s-maxage separately.</p></FlowStep>
              <FlowArrow label="bonus" accent={ACCENT} />
              <FlowStep n={4} title="stale-while-revalidate" what="Serve the cached copy instantly and refresh it in the background for next time." accent={ACCENT}><p className="font-mono text-xs">max-age=60, stale-while-revalidate=600</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
