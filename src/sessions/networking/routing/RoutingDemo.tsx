"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { DESTS, lookup, TABLE } from "@/lib/routing";

const ACCENT = "var(--net)";

export default function RoutingDemo() {
  const [ip, setIp] = useState("10.1.2.77");
  const r = lookup(ip);
  return (
    <SessionPage>
      <SessionHeader kicker="Networking · interactive" title="Routing: longest prefix wins" blurb="A router doesn't know the whole path, only which neighbour to send each packet to next. Its table lists address ranges; when several match, the most specific (longest prefix) wins." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Routing table">
              <p className="font-mono text-sm">packet to <b style={{ color: ACCENT }}>{ip}</b></p>
              <table className="mt-3 w-full text-sm">
                <thead><tr className="text-left text-xs text-[var(--faint)]"><th className="font-normal">prefix</th><th className="font-normal">next hop</th><th className="font-normal">match?</th></tr></thead>
                <tbody>
                  {TABLE.map((t) => {
                    const m = r.matches.includes(t.prefix), best = r.best.prefix === t.prefix;
                    return (
                      <tr key={t.prefix} style={{ background: best ? ACCENT : undefined, color: best ? "var(--on-accent)" : m ? undefined : "var(--faint)" }}>
                        <td className="py-1.5 pl-1 font-mono">{t.prefix}</td><td>{t.via} <span className="text-xs opacity-70">({t.note})</span></td><td className="pr-1 font-mono text-xs">{best ? "✓ longest" : m ? "✓" : "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-3 font-mono text-sm">→ forward to {r.best.via}</p>
            </section>
          }
          panel={<SystemMapPanel caption={`${r.matches.length} routes match ${ip}. /${r.best.len} is the most specific, so the packet goes to ${r.best.via}.`}><Choices label="Destination" accent={ACCENT} value={ip} onChange={setIp} options={DESTS.map((d) => ({ id: d, label: d }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Hop by hop" what="Each router decides only the next hop. The full path emerges from many local decisions." accent={ACCENT}><p className="font-mono text-xs">ip route show</p></FlowStep>
              <FlowArrow label="find matches" accent={ACCENT} />
              <FlowStep n={2} title="Most specific wins" what="10.1.2.77 is inside /8, /16 and /24. The /24 is the narrowest, so it's the most deliberate rule." accent={ACCENT} active={r.best.len > 8}><p className="text-sm text-[var(--muted)]">Routers use tries to do this in nanoseconds.</p></FlowStep>
              <FlowArrow label="nothing else matches" accent={ACCENT} />
              <FlowStep n={3} title="The default route" what="0.0.0.0/0 matches everything and is the fallback: “send it to the ISP”." accent={ACCENT} active={r.best.len === 0}><p className="text-sm text-[var(--muted)]">Your laptop&apos;s table is mostly this one line.</p></FlowStep>
              <FlowArrow label="between networks" accent={ACCENT} />
              <FlowStep n={4} title="BGP fills the internet's tables" what="Networks announce which prefixes they can reach. A mistaken, more specific announcement can hijack traffic, which is how big outages happen." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Cloud route tables work the same way.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
