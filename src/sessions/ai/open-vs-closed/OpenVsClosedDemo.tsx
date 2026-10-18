"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { ENGINEER, GPU_HOUR, HOSTED, MIN_REPLICAS, NEEDS, OPEN, PEAKS, TOKENS, VOLUMES, breakEven, hostedMonthly, pct, selfHostedMonthly, usd, type HostedId, type OpenId } from "@/lib/openVsClosed";

const ACCENT = "var(--ai)";
const HOSTED_COLOR = "var(--c1)";
const OPEN_COLOR = "var(--c4)";

export default function OpenVsClosedDemo() {
  const [volume, setVolume] = useState(10_000);
  const [peak, setPeak] = useState(5);
  const [hostedId, setHostedId] = useState<HostedId>("frontier");
  const [openId, setOpenId] = useState<OpenId>("open70");
  const [needs, setNeeds] = useState<Record<string, boolean>>({});
  const { stage, busy, run } = useWalk(5, 1100);
  const hosted = HOSTED.find((h) => h.id === hostedId)!;
  const open = OPEN.find((o) => o.id === openId)!;
  const api = hostedMonthly(hostedId, volume);
  const self = selfHostedMonthly(openId, volume, peak);
  const be = breakEven(hostedId, openId, peak);
  const at = (i: number) => stage === i;
  const cheaper = api < self.total ? "hosted" : "open";
  const picked = NEEDS.filter((n) => needs[n.id]);
  const forOpen = picked.filter((n) => n.favours === "open").length;
  const forHosted = picked.filter((n) => n.favours === "hosted").length;

  const captions = [
    `Step 1: ${volume.toLocaleString("en-US")} requests a day, ${TOKENS.input + TOKENS.output} tokens each, peaks at ${peak}× the average.`,
    `Step 2: the ${hosted.label.toLowerCase()} bills ${usd(api)} a month, every token paid for and nothing when idle.`,
    `Step 3: ${self.replicas} replicas of the ${open.label.toLowerCase()} for the peak, busy ${pct(self.utilization)} of the time: ${usd(self.total)} a month.`,
    be ? `Step 4: self-hosting gets cheaper at about ${be.toLocaleString("en-US")} requests a day.` : "Step 4: in this range the API stays cheaper at every volume.",
    picked.length ? `Step 5: ${forOpen} of your needs favour open weights and ${forHosted} favour a hosted API.` : "Step 5: tick what matters to you besides the bill.",
  ];
  const caption =
    stage !== null
      ? captions[stage]
      : `${cheaper === "hosted" ? hosted.label : open.label} is cheaper here: ${usd(Math.min(api, self.total))} against ${usd(Math.max(api, self.total))} a month.${be ? ` Break-even near ${be.toLocaleString("en-US")} requests a day.` : ""}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Open vs closed models"
        blurb="A closed model is an API you pay per token. An open model is a file of weights you run on GPUs you rent by the hour, busy or not. Slide your traffic and its peaks, watch the two bills cross, then weigh the things that aren't on the bill: privacy, control, quality and who's on call."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Monthly cost of the hosted API and of self-hosting against daily traffic">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  {volume.toLocaleString("en-US")} requests a day · peak {peak}×
                </p>
                <p className="font-mono text-sm">
                  <span style={{ color: HOSTED_COLOR }}>{usd(api)}</span> vs <span style={{ color: OPEN_COLOR }}>{usd(self.total)}</span>
                </p>
              </div>
              <CostChart hostedId={hostedId} openId={openId} peak={peak} volume={volume} />
              <dl className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="flex flex-col-reverse rounded-md bg-[var(--inset)] px-2 py-2">
                  <dt className="text-[11px] text-[var(--muted)]">{hosted.label}, per month</dt>
                  <dd className="font-mono text-base" style={{ color: HOSTED_COLOR }}>
                    {usd(api)}
                  </dd>
                </div>
                <div className="flex flex-col-reverse rounded-md bg-[var(--inset)] px-2 py-2">
                  <dt className="text-[11px] text-[var(--muted)]">
                    {open.label}: {self.replicas} replicas, {pct(self.utilization)} busy
                  </dt>
                  <dd className="font-mono text-base" style={{ color: OPEN_COLOR }}>
                    {usd(self.total)}
                  </dd>
                </div>
              </dl>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Requests a day" accent={ACCENT} value={String(volume)} onChange={(v) => setVolume(Number(v))} options={VOLUMES.map((v) => ({ id: String(v), label: v.toLocaleString("en-US") }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Costing…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Size your traffic" what="Requests a day, tokens per request, and how spiky it is. Peaks matter for GPUs: you pay for enough to serve the busiest minute." accent={ACCENT} active={at(0)}>
                <Choices label="Peak traffic, as a multiple of the average" accent={ACCENT} value={String(peak)} onChange={(v) => setPeak(Number(v))} options={PEAKS.map((p) => ({ id: String(p), label: `${p}×` }))} />
                <p className="mt-2 font-mono text-xs">
                  {TOKENS.input} in + {TOKENS.output} out per request · {((volume * (TOKENS.input + TOKENS.output)) / 86400).toFixed(0)} tokens/s on average
                </p>
              </FlowStep>
              <FlowArrow label="tokens per month" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Price the hosted API" what="Per-token prices, so the bill is a straight line: double the traffic, double the bill. Idle time costs nothing. You get the provider's best model the day it ships." accent={ACCENT} active={at(1)}>
                <Choices accent={ACCENT} value={hostedId} onChange={setHostedId} options={HOSTED.map((h) => ({ id: h.id, label: h.label }))} />
                <p className="mt-2 font-mono text-xs">
                  ${hosted.input}/M in · ${hosted.output}/M out · quality {pct(hosted.quality)} → {usd(api)} a month
                </p>
              </FlowStep>
              <FlowArrow label="the API bill" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Price your own GPUs" what={`Enough replicas for the peak, at least ${MIN_REPLICAS} so one can fail, each rented by the hour. Most of the day they sit partly idle. Add the time of whoever runs them.`} accent={ACCENT} active={at(2)}>
                <Choices accent={ACCENT} value={openId} onChange={setOpenId} options={OPEN.map((o) => ({ id: o.id, label: o.label }))} />
                <p className="mt-2 font-mono text-xs">
                  {self.replicas} replicas × {open.gpus} GPUs × ${GPU_HOUR}/h × 730 h = {usd(self.gpuBill)} · + {usd(ENGINEER)} of someone&rsquo;s time · busy {pct(self.utilization)} · quality {pct(open.quality)}
                </p>
              </FlowStep>
              <FlowArrow label="the GPU bill" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Find the break-even" what="With steady, heavy traffic the GPUs are busy and self-hosting wins. With spiky or small traffic, you pay for idle machines and the API wins. A cheap hosted tier moves the crossing far out." accent={ACCENT} active={at(3)}>
                <ul className="space-y-0.5 font-mono text-xs">
                  {VOLUMES.map((v) => {
                    const a = hostedMonthly(hostedId, v);
                    const s = selfHostedMonthly(openId, v, peak);
                    return (
                      <li key={v} className="flex justify-between gap-2" style={{ fontWeight: v === volume ? 700 : 400 }}>
                        <span>{v.toLocaleString("en-US")}/day</span>
                        <span>
                          <span style={{ color: HOSTED_COLOR }}>{usd(a)}</span> · <span style={{ color: OPEN_COLOR }}>{usd(s.total)}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-sm">{be ? `Break-even near ${be.toLocaleString("en-US")} requests a day.` : "No break-even below 10 million requests a day: the API stays cheaper."}</p>
              </FlowStep>
              <FlowArrow label="beyond the bill" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Weigh what isn't on the bill" what="Cost rarely decides alone. Tick what applies to you." accent={ACCENT} active={at(4)}>
                <ul className="space-y-1">
                  {NEEDS.map((n) => (
                    <li key={n.id}>
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input type="checkbox" checked={!!needs[n.id]} onChange={(e) => setNeeds((cur) => ({ ...cur, [n.id]: e.target.checked }))} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                        {n.label}
                        <span className="font-mono text-[11px]" style={{ color: n.favours === "open" ? OPEN_COLOR : HOSTED_COLOR }}>
                          → {n.favours}
                        </span>
                      </label>
                      {needs[n.id] && <p className="pl-6 text-xs text-[var(--muted)]">{n.why}</p>}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-mono text-xs">
                  {forOpen} for open weights · {forHosted} for a hosted API · bill favours {cheaper === "open" ? "open weights" : "hosted"}
                </p>
                <p className="mt-1 text-xs text-[var(--faint)]">Many teams do both: a hosted frontier model for the hard requests and an open model for the bulk. Prices are typical published rates.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function CostChart({ hostedId, openId, peak, volume }: { hostedId: HostedId; openId: OpenId; peak: number; volume: number }) {
  const W = 320;
  const H = 150;
  const pad = { l: 40, r: 10, t: 10, b: 26 };
  const vols = Array.from({ length: 41 }, (_, i) => 1000 * 10 ** (i / 10)); // 1k → 10M, log scale
  const x = (v: number) => pad.l + (Math.log10(v / 1000) / 4) * (W - pad.l - pad.r);
  const maxCost = Math.max(...vols.map((v) => Math.max(hostedMonthly(hostedId, v), selfHostedMonthly(openId, v, peak).total)));
  const y = (c: number) => pad.t + (1 - Math.log10(Math.max(100, c)) / Math.log10(maxCost)) * (H - pad.t - pad.b);
  const line = (f: (v: number) => number) => vols.map((v) => `${x(v)},${y(f(v))}`).join(" ");
  return (
    <figure className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Monthly cost against requests a day, both on log scales">
        {[1000, 10000, 100000, 1000000, 10000000].map((v) => (
          <text key={v} x={x(v)} y={H - 12} textAnchor="middle" fontSize={8} fill="var(--faint)">
            {v >= 1e6 ? `${v / 1e6}M` : `${v / 1e3}k`}
          </text>
        ))}
        {[1000, 10000, 100000, 1000000].filter((c) => c < maxCost).map((c) => (
          <g key={c}>
            <line x1={pad.l} x2={W - pad.r} y1={y(c)} y2={y(c)} stroke="var(--line)" strokeWidth={0.6} />
            <text x={pad.l - 4} y={y(c) + 3} textAnchor="end" fontSize={8} fill="var(--faint)">
              ${c >= 1e6 ? `${c / 1e6}M` : `${c / 1e3}k`}
            </text>
          </g>
        ))}
        <text x={(pad.l + W - pad.r) / 2} y={H - 2} textAnchor="middle" fontSize={8} fill="var(--faint)">
          requests a day
        </text>
        <line x1={x(volume)} x2={x(volume)} y1={pad.t} y2={H - pad.b} stroke="var(--line-strong)" strokeDasharray="2 2" strokeWidth={0.8} />
        <polyline points={line((v) => hostedMonthly(hostedId, v))} fill="none" stroke={HOSTED_COLOR} strokeWidth={2} />
        <polyline points={line((v) => selfHostedMonthly(openId, v, peak).total)} fill="none" stroke={OPEN_COLOR} strokeWidth={2} />
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: HOSTED_COLOR }} />
          hosted API
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: OPEN_COLOR }} />
          open weights on rented GPUs
        </span>
      </figcaption>
    </figure>
  );
}
