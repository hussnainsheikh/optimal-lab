"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { DESIGNS, LIMIT, OUTAGE, SCRAPER_RPS, SECONDS, SENT, SERVERS, STORE_RTT_MS, SYNCS, simulate, type Design, type FailMode, type Outcome } from "@/lib/rateLimiterDesign";

const ACCENT = "var(--sys)";

export default function RateLimiterDesignDemo() {
  const [d, setD] = useState<Design>("local");
  const [sync, setSync] = useState(5);
  const [outage, setOutage] = useState(false);
  const [fail, setFail] = useState<FailMode>("open");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const r = simulate(d, { sync, outage, fail });
  const usesStore = d === "central" || d === "synced";
  const firstReject = r.scraper.perSecond.findIndex((s) => s.rejected > 0);
  const retryAfter = firstReject < 0 ? null : SECONDS - firstReject;
  const over = r.scraper.allowed - LIMIT;

  const packets: Packet[] =
    stage === 0 ? hops("k", ["scraper", "lb", "api"], { label: "key sk_42" })
    : stage === 1 ? hops("c", d === "central" ? ["lb", "api", "redis"] : ["lb", "api"], { label: d === "central" ? "INCR" : "local count" })
    : stage === 2 ? (d === "synced" ? hops("s", ["api", "redis"], { label: `sync every ${sync} s` }) : d === "central" ? hops("s", ["api", "redis", "api"], { label: `+${STORE_RTT_MS} ms` }) : [])
    : stage === 3 ? (usesStore && outage ? hops("o", ["api", "redis"], { label: "timeout", tone: "bad" }) : [])
    : stage === 4 ? hops("n", ["api", "lb", "scraper"], { label: `429 · Retry-After ${retryAfter ?? 0}`, tone: "bad" })
    : [];

  const captions = [
    `Step 1: the rule is ${LIMIT} requests a minute per API key. The scraper sends ${SENT.scraper}; the app sends ${SENT.app}.`,
    `Step 2: ${DESIGNS.find((x) => x.id === d)!.label}: the scraper gets ${r.scraper.allowed} through, the app ${r.app.allowed} of ${SENT.app}.`,
    d === "central" ? `Step 3: every request waits ${STORE_RTT_MS} ms for Redis: ${r.storeCalls.toLocaleString("en-US")} calls this minute.` : d === "synced" ? `Step 3: servers sync every ${sync} s: ${r.storeCalls} calls, and the scraper gets ${over} past the limit before they hear about each other.` : "Step 3: no shared store: nothing added to the request path, and no server knows what the others allowed.",
    !usesStore ? "Step 4: there is no store to fail." : !outage ? "Step 4: turn on the outage to see the store fail." : `Step 4: Redis is down from ${OUTAGE[0]} s to ${OUTAGE[1]} s; failing ${fail}, the scraper gets ${r.scraper.allowed} and the app ${r.app.allowed}.`,
    retryAfter === null ? "Step 5: nobody was rejected." : `Step 5: rejected requests get 429 with Retry-After: ${retryAfter}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${DESIGNS.find((x) => x.id === d)!.label}: scraper ${r.scraper.allowed} of ${SENT.scraper} (limit ${LIMIT}) · app ${r.app.allowed} of ${SENT.app} · +${r.addedMs} ms a request.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · case study"
        title="Design a rate limiter"
        blurb={`An API runs on ${SERVERS} servers behind a load balancer. Each API key may make ${LIMIT} requests a minute. A scraper sends ${SCRAPER_RPS} a second across all servers; a normal app sends one a second over a single connection. Decide where the counters live, what each check costs, and what happens when the counter store goes down.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Two clients, a load balancer, four API servers and Redis"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "scraper", label: "Scraper", sub: `${SCRAPER_RPS}/s`, at: [13, 22], mobileAt: [22, 9], state: r.scraper.allowed > LIMIT ? "bad" : "active" },
                  { id: "app", label: "App", sub: "1/s, one connection", at: [13, 78], mobileAt: [78, 9], state: r.app.allowed < SENT.app ? "bad" : "good" },
                  { id: "lb", label: "Load balancer", sub: "spreads requests", at: [36, 50], mobileAt: [50, 36], state: "active" },
                  { id: "api", label: `API servers ×${SERVERS}`, sub: d === "local" || d === "split" ? "count locally" : "check Redis", at: [63, 50], mobileAt: [50, 64], state: "active" },
                  { id: "redis", label: "Redis", sub: outage && usesStore ? `down ${OUTAGE[0]}–${OUTAGE[1]} s` : usesStore ? "shared counters" : "unused", at: [87, 50], mobileAt: [50, 91], state: !usesStore ? "dim" : outage ? "bad" : "good" },
                ]}
                links={[
                  { from: "scraper", to: "lb", label: "requests" },
                  { from: "app", to: "lb", label: "requests" },
                  { from: "lb", to: "api", label: "round robin" },
                  { from: "api", to: "redis", label: "INCR", dim: !usesStore },
                ]}
                packets={packets}
                aspect={2}
                mobileAspect={0.95}
              />
              <Chart scraper={r.scraper} app={r.app} outage={outage && usesStore} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Counters" accent={ACCENT} value={d} onChange={setD} options={DESIGNS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Limiting…">
                Send a request
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Define the rule" what="What is counted (an API key, a user, an IP), how many, and over what window. Here: 100 requests a minute per API key, counted in one-minute windows. The algorithm (fixed window, sliding window, token bucket) is its own choice; the hard part at scale is where the count lives." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  key = api_key · limit {LIMIT} · window 60 s · scraper sends {SENT.scraper}, app sends {SENT.app}
                </p>
              </FlowStep>
              <FlowArrow label="count it" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Decide where the counters live" what="Counting on each server is free but each server only sees its share: the limit multiplies by the server count, or, divided up, punishes a client whose connection sticks to one server. A shared store sees every request." accent={ACCENT} active={at(1)}>
                <Choices label="Counters" accent={ACCENT} value={d} onChange={setD} options={DESIGNS.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{DESIGNS.find((x) => x.id === d)!.one}</p>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">scraper</span>
                  <span className="text-right text-[var(--faint)]">app</span>
                  {DESIGNS.map((x) => {
                    const y = simulate(x.id, { sync, outage: false, fail });
                    return <Row key={x.id} cells={[x.label, String(y.scraper.allowed), `${y.app.allowed}/${SENT.app}`]} on={x.id === d} bad={[y.scraper.allowed > LIMIT, y.app.allowed < SENT.app]} />;
                  })}
                </div>
              </FlowStep>
              <FlowArrow label="on every request" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Keep the check cheap" what="A round trip to Redis on every request adds about a millisecond and a call per request. Counting locally and syncing every few seconds removes both, and lets a fast client overshoot by whatever it sends between syncs." accent={ACCENT} active={at(2)}>
                <Choices label="Sync every" accent={ACCENT} value={String(sync)} onChange={(v) => setSync(Number(v))} options={SYNCS.map((s) => ({ id: String(s), label: `${s} s` }))} />
                <p className="mt-2 font-mono text-xs">
                  {d === "central" ? `+${STORE_RTT_MS} ms · ${r.storeCalls.toLocaleString("en-US")} Redis calls a minute` : d === "synced" ? `+0 ms · ${r.storeCalls} Redis calls a minute · scraper ${over > 0 ? `${over} over` : "on"} the limit` : "+0 ms · no shared state"}
                </p>
              </FlowStep>
              <FlowArrow label="the store fails" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Decide what happens when the store fails" what="Fail open and the limiter disappears exactly when something is wrong; fail closed and every customer is locked out. Most APIs fail open with a short timeout and fall back to a generous local limit." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={outage} onChange={(e) => setOutage(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Redis is down from {OUTAGE[0]} s to {OUTAGE[1]} s
                </label>
                <Choices label="When it fails" accent={ACCENT} value={fail} onChange={setFail} options={[{ id: "open" as FailMode, label: "Fail open" }, { id: "closed" as FailMode, label: "Fail closed" }]} />
                <p className="mt-2 font-mono text-xs">
                  {!usesStore ? "no store in this design" : `scraper ${r.scraper.allowed} · app ${r.app.allowed}/${SENT.app}`}
                </p>
              </FlowStep>
              <FlowArrow label="the answer" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Tell the client" what="Reject with 429 Too Many Requests and say when to come back. Send the remaining budget on every response so well-behaved clients slow down before they hit the wall." accent={ACCENT} active={at(4)}>
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px]">
                  {retryAfter === null ? "HTTP/1.1 200 OK\nRateLimit-Limit: 100" : `HTTP/1.1 429 Too Many Requests\nRetry-After: ${retryAfter}\nRateLimit-Limit: ${LIMIT}\nRateLimit-Remaining: 0\nRateLimit-Reset: ${retryAfter}`}
                </pre>
                <p className="mt-2 text-[11px] text-[var(--faint)]">One fixed one-minute window; requests are spread over the servers at random with a fixed seed.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, on, bad }: { cells: string[]; on: boolean; bad: boolean[] }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ color: i > 0 && bad[i - 1] ? "var(--bad)" : on ? "var(--text)" : "var(--muted)", fontWeight: on ? 600 : 400 }}>
          {c}
        </span>
      ))}
    </>
  );
}

// Requests allowed and rejected each second, for each client.
function Chart({ scraper, app, outage }: { scraper: Outcome; app: Outcome; outage: boolean }) {
  const rows: [string, Outcome, number][] = [
    ["scraper", scraper, SCRAPER_RPS],
    ["app", app, 1],
  ];
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label={`Over one minute the scraper got ${scraper.allowed} requests through and the app ${app.allowed}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">one minute · per second</p>
        <p className="font-mono text-xs text-[var(--muted)]">
          limit {LIMIT} · scraper <span style={{ color: scraper.allowed > LIMIT ? "var(--bad)" : "var(--good)" }}>{scraper.allowed}</span> · app <span style={{ color: app.allowed < SENT.app ? "var(--bad)" : "var(--good)" }}>{app.allowed}</span>
        </p>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map(([name, o, max]) => (
          <div key={name} className="flex items-end gap-2">
            <span className="w-12 shrink-0 font-mono text-[11px] text-[var(--muted)]">{name}</span>
            <div className="flex h-10 min-w-0 flex-1 items-end gap-px">
              {o.perSecond.map((s, i) => (
                <span key={i} className="flex h-full min-w-0 flex-1 flex-col justify-end" style={{ background: outage && i >= OUTAGE[0] && i < OUTAGE[1] ? "color-mix(in srgb, var(--bad) 10%, transparent)" : "transparent" }}>
                  <span style={{ height: `${(s.rejected / max) * 100}%`, background: "var(--bad)", opacity: 0.55 }} />
                  <span style={{ height: `${(s.allowed / max) * 100}%`, background: "var(--good)" }} />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: "var(--good)" }} /> allowed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: "var(--bad)", opacity: 0.55 }} /> rejected
        </span>
        <span>0 s → 60 s</span>
      </div>
    </section>
  );
}
