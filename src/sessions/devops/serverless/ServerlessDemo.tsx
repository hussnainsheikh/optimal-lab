"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, Slider } from "@/components/session/ui";
import { COLD, costs, SERIES } from "@/lib/serverlessCost";

const ACCENT = "var(--ops)";
const LX = (m: number) => 30 + ((Math.log10(m) + 1) / 3.5) * 350;
const LY = (usd: number) => 180 - (Math.log10(Math.max(usd, 0.1)) + 1) / 4 * 165;

export default function ServerlessDemo() {
  const [i, setI] = useState(3);
  const [shape, setShape] = useState<keyof typeof COLD>("spiky");
  const m = SERIES[i].m;
  const c = costs(m);
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Serverless functions" blurb="Functions run only when called and bill per request and millisecond. Nothing runs, nothing is billed. Containers bill for every hour they're up, busy or not. Which is cheaper depends on traffic, and new function instances pay a cold start. Prices are examples." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Monthly cost by traffic">
              <svg viewBox="0 0 400 200" className="w-full">
                <path d={SERIES.map((s, k) => `${k ? "L" : "M"}${LX(s.m)} ${LY(s.fn)}`).join(" ")} fill="none" stroke={ACCENT} strokeWidth="2.5" />
                <path d={SERIES.map((s, k) => `${k ? "L" : "M"}${LX(s.m)} ${LY(s.containers)}`).join(" ")} fill="none" stroke="var(--auto)" strokeWidth="2.5" strokeDasharray="5 4" />
                <line x1={LX(m)} x2={LX(m)} y1="10" y2="182" stroke="var(--muted)" strokeDasharray="2 3" />
                <text x="30" y="196" fontSize="10" fill="var(--faint)">0.1M req/mo</text><text x="380" y="196" fontSize="10" textAnchor="end" fill="var(--faint)">300M</text>
              </svg>
              <p className="text-xs text-[var(--muted)]"><span style={{ color: ACCENT }}>Solid: functions.</span> <span style={{ color: "var(--auto)" }}>Dashed: two always-on containers.</span> Log scales.</p>
              <dl className="mt-3 grid grid-cols-3 gap-2">
                {[["Functions", `$${c.fn.toFixed(c.fn < 10 ? 2 : 0)}/mo`], ["Containers", `$${c.containers}/mo`], ["Cold starts", `${(COLD[shape] * 100).toFixed(1)}% of requests`]].map(([k, v]) => <div key={k} className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">{k}</dt><dd className="font-mono">{v}</dd></div>)}
              </dl>
            </section>
          }
          panel={
            <SystemMapPanel caption={`At ${m}M requests a month, functions cost $${c.fn.toFixed(c.fn < 10 ? 2 : 0)} vs $${c.containers} for containers. ${c.fn < c.containers ? "Low or bursty traffic: functions win because idle time is free." : "Steady high traffic: paying per request now costs more than keeping servers busy."} ${shape === "rare" ? "With rare traffic, most requests start a cold instance (hundreds of ms)." : ""}`}>
              <Slider label="Requests per month" accent={ACCENT} value={i} min={0} max={SERIES.length - 1} step={1} format={(k) => `${SERIES[k].m}M`} onChange={setI} />
              <Choices label="Traffic shape" accent={ACCENT} value={shape} onChange={setShape} options={[{ id: "steady", label: "Steady" }, { id: "spiky", label: "Spiky" }, { id: "rare", label: "Rare" }]} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Pay per use, scale to zero" what="No servers to manage; idle costs nothing; each request gets an instance, up to a concurrency limit." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Great for glue code, webhooks, cron.</p></FlowStep>
              <FlowArrow label="the catch" accent={ACCENT} />
              <FlowStep n={2} title="Cold starts" what="A new instance loads your code first: tens of ms to seconds. Keep bundles small or pay for provisioned concurrency." accent={ACCENT} active={shape !== "steady"}><p className="text-sm text-[var(--muted)]">Worst for rare, latency-sensitive calls.</p></FlowStep>
              <FlowArrow label="at scale" accent={ACCENT} />
              <FlowStep n={3} title="Steady load flips the maths" what="Busy servers are cheaper per request. Many teams start serverless and move hot paths to containers later." accent={ACCENT} active={c.fn >= c.containers}><p className="text-sm text-[var(--muted)]">Watch database connections too.</p></FlowStep>
              <FlowArrow label="limits" accent={ACCENT} />
              <FlowStep n={4} title="Design for statelessness and timeouts" what="Max run time, no local disk between calls, per-region concurrency caps." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Lambda, Cloud Run, Cloudflare Workers.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
