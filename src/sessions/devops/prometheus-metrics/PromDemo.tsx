"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { BUCKETS, counterSeries, quantile, rate } from "@/lib/promMetrics";

const ACCENT = "var(--ops)";
const SERIES = counterSeries();
const RATE = rate(SERIES);
type View = "raw" | "rate" | "histogram";

export default function PromDemo() {
  const [v, setV] = useState<View>("raw");
  const max = v === "raw" ? Math.max(...SERIES.map((s) => s.value)) : 35;
  const p95 = quantile(0.95), p50 = quantile(0.5);
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="Prometheus metrics: counters, rates and histograms" blurb="Prometheus scrapes numbers from your app every 15 seconds. A request counter only ever goes up, until the pod restarts and it drops to zero. Raw counters are almost useless; rate() and histograms turn them into answers." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Metric view">
              <pre className="rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{v === "raw" ? "http_requests_total" : v === "rate" ? "rate(http_requests_total[1m])" : "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"}</pre>
              {v !== "histogram" ? (
                <>
                  <div className="mt-3 flex h-36 items-end gap-1">
                    {SERIES.map((s, i) => { const val = v === "raw" ? s.value : RATE[i]; return <span key={i} className="flex-1 rounded-t-sm" title={val === null ? "not enough data" : String(val)} style={{ height: `${val === null ? 2 : (val / max) * 100}%`, background: val === null ? "var(--ghost)" : i === 10 && v === "raw" ? "var(--bad)" : ACCENT }} />; })}
                  </div>
                  <div className="flex justify-between font-mono text-[10px] text-[var(--faint)]"><span>0 s</span><span>restart at 150 s</span><span>300 s</span></div>
                  {v === "rate" && <p className="mt-2 font-mono text-xs text-[var(--muted)]">true rate: {SERIES.map((s) => s.trueRate).join(" ")}</p>}
                </>
              ) : (
                <>
                  <ul className="mt-3 space-y-1">{BUCKETS.map((b) => <li key={b.le} className="grid grid-cols-[4.5rem_minmax(0,1fr)_3rem] items-center gap-2 font-mono text-xs"><span>le {b.le === Infinity ? "+Inf" : `${b.le}s`}</span><span className="h-3 rounded bg-[var(--track)]"><span className="block h-full rounded" style={{ width: `${b.count / 10}%`, background: ACCENT }} /></span><span className="text-right">{b.count}</span></li>)}</ul>
                  <p className="mt-3 font-mono text-sm">p50 ≈ {(p50 * 1000).toFixed(0)} ms · p95 ≈ {(p95 * 1000).toFixed(0)} ms</p>
                </>
              )}
            </section>
          }
          panel={
            <SystemMapPanel caption={v === "raw" ? "A total since the process started. It climbs forever, and drops to 0 when the pod restarts at 150 s. The height tells you nothing about current traffic." : v === "rate" ? "rate() takes the per-second increase over a window and treats a drop as a reset, so the restart vanishes and you see real traffic: the spikes are visible." : "Each bucket counts requests at or under that duration. Prometheus interpolates within buckets to estimate percentiles, so pick bucket edges near your SLO."}>
              <Choices label="Query" accent={ACCENT} value={v} onChange={setV} options={[{ id: "raw", label: "Raw counter" }, { id: "rate", label: "rate()" }, { id: "histogram", label: "Latency histogram" }]} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Counters only go up" what="Requests, errors, bytes. Always query them through rate() or increase()." accent={ACCENT} active={v === "raw"}><p className="text-sm text-[var(--muted)]">Gauges (memory, queue length) go up and down.</p></FlowStep>
              <FlowArrow label="per second" accent={ACCENT} />
              <FlowStep n={2} title="rate() handles resets" what="Per-second average increase over the window. Use a window at least 4× the scrape interval." accent={ACCENT} active={v === "rate"}><p className="font-mono text-xs">sum by (route) (rate(http_requests_total[5m]))</p></FlowStep>
              <FlowArrow label="latency" accent={ACCENT} />
              <FlowStep n={3} title="Histograms for percentiles" what="Averages hide slow requests. Buckets let you compute p95 and p99 across all pods." accent={ACCENT} active={v === "histogram"}><p className="text-sm text-[var(--muted)]">Can&apos;t average percentiles; can sum buckets.</p></FlowStep>
              <FlowArrow label="careful" accent={ACCENT} />
              <FlowStep n={4} title="Watch label cardinality" what="Every label combination is a separate series. Never label by user id or full URL." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Millions of series will sink Prometheus.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
