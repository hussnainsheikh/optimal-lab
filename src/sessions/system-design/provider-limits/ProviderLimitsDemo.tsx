"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { BACKGROUND_SHARE, BASE, BURST, BURST_FROM, BURST_TO, FALLBACK_CAPACITY, MAX_QUEUE_WAIT, MINUTES, PER_MIN_CAPACITY, STRATEGIES, TOKENS_PER_REQ, TPM, run, type Strategy } from "@/lib/providerLimits";

const ACCENT = "var(--sys)";

export default function ProviderLimitsDemo() {
  const [s, setS] = useState<Strategy>("naive");
  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Provider rate limits and quotas"
        blurb={`An app calls an LLM provider with a limit of ${(TPM / 1000).toFixed(0)}k tokens a minute, about ${PER_MIN_CAPACITY} requests. Normal traffic is ${BASE} a minute; a marketing email sends it to ${BURST} for ten minutes. ${Math.round(BACKGROUND_SHARE * 100)}% of the calls are background jobs that could wait. Step through twenty minutes under five strategies.`}
      />
      <div className="mt-6">
        <Run key={s} s={s} setS={setS} />
      </div>
    </SessionPage>
  );
}

function Run({ s, setS }: { s: Strategy; setS: (s: Strategy) => void }) {
  const r = run(s);
  const playback = usePlayback(MINUTES, 700);
  const m = r.minutes[playback.i];
  const started = playback.i > 0 || playback.playing;
  const limited = s !== "naive" && s !== "retry";
  const packets: Packet[] = !started
    ? []
    : [
        ...hops(`a-${playback.i}`, limited ? ["app", "limiter", "provider"] : ["app", "provider"], { label: `${m.ok}/min`, tone: m.rejected ? "bad" : "accent" }),
        ...(m.rejected ? hops(`r-${playback.i}`, ["provider", "app"], { label: `${m.rejected} × 429`, tone: "bad", start: 0.6 }) : []),
        ...(m.fallback ? hops(`f-${playback.i}`, ["limiter", "fallback"], { label: `${m.fallback} overflow`, tone: "good" }) : []),
      ];
  const caption = `Minute ${m.m}${m.m >= BURST_FROM && m.m < BURST_TO ? " (burst)" : ""}: ${m.arrived} arrive, ${m.ok} served by the provider${m.fallback ? `, ${m.fallback} by the fallback` : ""}${m.rejected ? `, ${m.rejected} rejected with 429` : ""}${m.dropped ? `, ${m.dropped} users give up` : ""}${limited ? `; ${m.queued} waiting` : ""}.`;
  const maxQ = Math.max(1, ...r.minutes.map((x) => x.queued));
  const maxBar = Math.max(BURST * (s === "retry" ? 4 : 1), ...r.minutes.map((x) => x.sent));

  return (
    <SessionLayout
      visual={
        <div className="space-y-3">
          <SystemMap
            title="Your app, a shared rate limiter with a queue, the main provider and a fallback provider"
            accent={ACCENT}
            chrome="split"
            nodes={[
              { id: "app", label: "Your app", sub: `${m.arrived}/min`, at: [10, 50], mobileAt: [50, 8], state: "active" },
              { id: "limiter", label: "Limiter + queue", sub: limited ? `${m.queued} waiting` : "none", at: [40, 50], mobileAt: [50, 38], state: limited ? (m.queued > 500 ? "wait" : "active") : "dim" },
              { id: "provider", label: "Provider", sub: `${PER_MIN_CAPACITY}/min limit`, at: [74, 24], mobileAt: [22, 80], state: m.rejected ? "bad" : "active" },
              { id: "fallback", label: "Fallback", sub: s === "fallback" ? `${FALLBACK_CAPACITY}/min` : "none", at: [74, 78], mobileAt: [78, 80], state: s === "fallback" ? (m.fallback ? "good" : "idle") : "dim" },
            ]}
            links={[
              { from: "app", to: "limiter", label: "requests", dim: !limited },
              { from: "limiter", to: "provider", label: "≤ limit", dim: !limited },
              { from: "app", to: "provider", label: "direct", dim: limited },
              { from: "limiter", to: "fallback", label: "overflow", dim: s !== "fallback" },
              { from: "provider", to: "app", label: "429", dashed: true, dim: limited },
            ]}
            packets={packets}
            aspect={2}
            mobileAspect={0.95}
          />
          <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" aria-label="Requests sent and waiting each minute">
            <div className="flex h-20 items-end gap-0.5">
              {r.minutes.map((x) => (
                <div key={x.m} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`minute ${x.m}: ${x.sent} sent, ${x.rejected} rejected, ${x.queued} waiting`}>
                  <span className="block w-full rounded-t" style={{ height: `${(x.rejected / maxBar) * 100}%`, background: "var(--bad)", opacity: x.m <= playback.i ? 1 : 0.35 }} />
                  <span className="block w-full" style={{ height: `${(x.ok / maxBar) * 100}%`, background: ACCENT, opacity: x.m <= playback.i ? 1 : 0.35 }} />
                </div>
              ))}
            </div>
            {limited && (
              <div className="mt-1 flex h-8 items-start gap-0.5">
                {r.minutes.map((x) => (
                  <span key={x.m} className="block min-w-0 flex-1 rounded-b" style={{ height: `${(x.queued / maxQ) * 100}%`, background: "var(--c3)", opacity: x.m <= playback.i ? 0.8 : 0.3 }} />
                ))}
              </div>
            )}
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              Up: served (accent) and rejected with 429 (red) each minute.{limited ? " Down: requests waiting in the queue." : ""} Burst from minute {BURST_FROM} to {BURST_TO}.
            </p>
          </section>
        </div>
      }
      panel={
        <SystemMapPanel caption={caption}>
          <div className="w-full">
            <Choices label="Strategy" accent={ACCENT} value={s} onChange={setS} options={STRATEGIES.map((x) => ({ id: x.id, label: x.label }))} />
          </div>
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next minute" status={`minute ${playback.i} of ${MINUTES - 1}`} />
          <p className="w-full font-mono text-xs" style={{ color: r.interactiveFailed ? "var(--bad)" : "var(--good)" }}>
            {r.interactiveFailed.toLocaleString("en-US")} users failed · {r.totalRejected.toLocaleString("en-US")} 429s
          </p>
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Know the limits you're under" what={`Providers limit requests a minute and tokens a minute, per key, per model, per organisation. At about ${TOKENS_PER_REQ.toLocaleString("en-US")} tokens a call, ${(TPM / 1000).toFixed(0)}k tokens a minute is ${PER_MIN_CAPACITY} calls. Past it you get 429 Too Many Requests.`} accent={ACCENT} active={s === "naive"}>
            <p className="font-mono text-xs">
              normal {BASE}/min · burst {BURST}/min · limit {PER_MIN_CAPACITY}/min
            </p>
          </FlowStep>
          <FlowArrow label="when you go over" accent={ACCENT} />

          <FlowStep n={2} title="Don't retry into the wall" what="Retrying a 429 at once sends the same request into the same full minute. Every retry is another rejection, and the provider may slow you down further. Retry after the time in the Retry-After header, with jitter." accent={ACCENT} active={s === "retry"}>
            <Line s="naive" />
            <Line s="retry" />
          </FlowStep>
          <FlowArrow label="pace yourself" accent={ACCENT} />

          <FlowStep n={3} title="Limit yourself before the provider does" what="A token bucket shared by all your servers releases at most the provider's limit and queues the rest. No 429s, but during a burst everything waits in one line, and interactive users give up after a few minutes." accent={ACCENT} active={s === "bucket"}>
            <Line s="bucket" />
            <p className="mt-1 text-[11px] text-[var(--muted)]">Users give up after {MAX_QUEUE_WAIT} minutes in the queue.</p>
          </FlowStep>
          <FlowArrow label="who goes first" accent={ACCENT} />

          <FlowStep n={4} title="Put interactive requests first" what="A person waiting on a reply and a nightly summary job aren't equal. Serve interactive requests first and let background work use the spare capacity, even if it finishes hours later." accent={ACCENT} active={s === "priority"}>
            <Line s="priority" />
          </FlowStep>
          <FlowArrow label="more capacity" accent={ACCENT} />

          <FlowStep n={5} title="Overflow to a second provider" what={`When the main limit is spent, send interactive overflow to another region, another key tier, or another provider (${FALLBACK_CAPACITY}/min here). Ask for a higher limit before a launch, too.`} accent={ACCENT} active={s === "fallback"}>
            <Line s="fallback" />
            <p className="mt-2 text-[11px] text-[var(--faint)]">One request ≈ {TOKENS_PER_REQ.toLocaleString("en-US")} tokens; limits and traffic are round numbers.</p>
          </FlowStep>
        </>
      }
    />
  );
}

function Line({ s }: { s: Strategy }) {
  const r = run(s);
  const label = STRATEGIES.find((x) => x.id === s)!.label;
  return (
    <p className="font-mono text-xs" style={{ color: r.interactiveFailed ? "var(--bad)" : "var(--good)" }}>
      {label}: {r.interactiveFailed.toLocaleString("en-US")} users failed · {r.totalRejected.toLocaleString("en-US")} × 429 · longest wait {r.maxWait} min{r.fallbackUsed ? ` · ${r.fallbackUsed.toLocaleString("en-US")} via fallback` : ""} · {r.backgroundLeft.toLocaleString("en-US")} background jobs still queued
    </p>
  );
}
