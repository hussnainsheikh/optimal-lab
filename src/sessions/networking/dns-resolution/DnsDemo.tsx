"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { NAME, resolve } from "@/lib/dnsResolve";

const ACCENT = "var(--net)";

export default function DnsDemo() {
  const [cache, setCache] = useState<"cold" | "warm">("cold");
  const hops = resolve(cache === "warm");
  const playback = usePlayback(hops.length, 1100);
  const h = hops[playback.i];
  const elapsed = hops.slice(0, playback.i + 1).reduce((s, x) => s + x.ms, 0);
  const total = hops.reduce((s, x) => s + x.ms, 0);

  return (
    <SessionPage>
      <SessionHeader kicker="Networking · interactive" title="DNS resolution, hop by hop" blurb={`Before your browser can connect to ${NAME}, it needs an IP address. Nobody holds the whole phone book: the answer is found by asking a chain of servers, each pointing to the next. Caches skip most of the chain.`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Who is asked, in order">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Looking up {NAME}</p>
                <p className="font-mono text-xs text-[var(--muted)]">{elapsed} ms so far</p>
              </div>
              <ol className="mt-3 space-y-2">
                {hops.map((x, i) => {
                  const shown = i <= playback.i;
                  return (
                    <li key={i} className="rounded-lg border p-2.5 text-sm" style={{ borderColor: i === playback.i ? ACCENT : "var(--line)", background: "var(--inset)", opacity: shown ? 1 : 0.35 }}>
                      <p className="flex flex-wrap justify-between gap-2"><span className="font-medium">{x.who}</span><span className="font-mono text-xs text-[var(--faint)]">{x.ms ? `+${x.ms} ms` : "local"}</span></p>
                      {shown && <p className="mt-1 font-mono text-xs" style={{ color: x.answer.startsWith("A ") || x.answer.startsWith("cached") ? "var(--good)" : "var(--muted)" }}>→ {x.answer}</p>}
                    </li>
                  );
                })}
              </ol>
            </section>
          }
          panel={
            <SystemMapPanel caption={`${h.who}: ${h.answer}`}>
              <Choices label="Resolver cache" accent={ACCENT} value={cache} onChange={(v) => { setCache(v); playback.reset(); }} options={[{ id: "cold", label: "Cold (first visit)" }, { id: "warm", label: "Warm (someone asked recently)" }]} />
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next hop" status={`total ${total} ms`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Check the local caches" what="The browser and the operating system remember recent answers until their TTL runs out." accent={ACCENT} active={playback.i < 2}><p className="text-sm text-[var(--muted)]">Here neither has it.</p></FlowStep>
              <FlowArrow label="ask the resolver" accent={ACCENT} />
              <FlowStep n={2} title="Ask a recursive resolver" what="Your ISP's resolver, or a public one like 1.1.1.1, does the legwork. It caches answers for everyone who uses it." accent={ACCENT} active={playback.i === 2}><p className="text-sm text-[var(--muted)]">{cache === "warm" ? "Warm: it already knows. Done in one hop." : "Cold: it has to go find out."}</p></FlowStep>
              <FlowArrow label="follow the referrals" accent={ACCENT} />
              <FlowStep n={3} title="Root, then TLD, then the domain's own servers" what="The root knows who runs .example. The .example servers know who runs shop.example. Only shop.example's servers know the actual address." accent={ACCENT} active={playback.i > 2}><p className="text-sm text-[var(--muted)]">{cache === "warm" ? "Skipped." : "Three more round trips."}</p></FlowStep>
              <FlowArrow label="the answer, with a TTL" accent={ACCENT} />
              <FlowStep n={4} title="The TTL decides how long it's cached" what="A 300-second TTL means changes take up to five minutes to reach everyone. Lower it before a migration; raise it for speed." accent={ACCENT} active={playback.atEnd}><p className="font-mono text-sm">cold {resolve(false).reduce((s, x) => s + x.ms, 0)} ms · warm {resolve(true).reduce((s, x) => s + x.ms, 0)} ms</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
