"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { ALERTS, ALL, BAD_ADDRESSES, MAX_BOUNCE, MAX_COMPLAINT, NONE, OPTED_OUT, PROVIDER_RATE, QUIET_HOURS, REDELIVERY, THROTTLED_SHARE, USERS, n, pct, run, type Settings } from "@/lib/notifications";

const ACCENT = "var(--sys)";
const REP_COLOR = { good: "var(--good)", "at risk": "var(--text)", throttled: "var(--bad)" } as const;

export default function NotificationsDemo() {
  const [s, setS] = useState<Settings>(NONE);
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const set = (k: keyof Settings, v: boolean) => setS((cur) => ({ ...cur, [k]: v }));
  const at = (i: number) => stage === i;
  const r = run(s);
  const next = run(s, 2);

  const packets: Packet[] =
    stage === 0 ? hops("ev", ["app", "notify"], { label: `${ALERTS} alerts` })
    : stage === 1 ? hops("q", ["notify", "queue"], { label: `${n(r.afterDigest)} msgs` })
    : stage === 2 ? hops("w", ["queue", "worker", "provider"], { label: s.dedupe ? "idempotent send" : "send", tone: s.dedupe ? "good" : "accent" })
    : stage === 3 ? hops("p", ["provider", "inbox"], { label: `${PROVIDER_RATE}/s`, tone: s.backoff ? "accent" : "bad" })
    : stage === 4 ? hops("wh", ["provider", "notify"], { label: `${n(r.bounces)} bounces`, tone: s.suppression ? "good" : "bad" })
    : [];

  const captions = [
    `Step 1: an incident sends ${ALERTS} alerts to ${USERS.toLocaleString("en-US")} subscribers: ${n(r.intended)} possible emails.`,
    `Step 2: preferences, quiet hours and the digest leave ${n(r.afterDigest)} to send now${r.deferred ? `, ${n(r.deferred)} for the morning` : ""}.`,
    `Step 3: workers send from the queue; ${s.dedupe ? "an idempotency key stops redelivered messages going out twice" : `${n(r.duplicates)} are sent twice after worker crashes`}.`,
    `Step 4: the provider takes ${PROVIDER_RATE} a second: ${r.minutes.toFixed(1)} minutes; ${s.backoff ? "429s are retried with backoff" : `${n(r.failedThrottle)} are lost to 429s`}.`,
    `Step 5: ${n(r.bounces)} bounce and ${n(r.complaints)} complain: sender reputation ${r.reputation}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${n(r.sent)} emails sent · ${n(r.duplicates)} duplicates · ${n(r.unwanted)} unwanted · ${n(r.failedThrottle)} lost to rate limits · reputation ${r.reputation}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Email and notification delivery"
        blurb={`An incident: ${ALERTS} status alerts to ${USERS.toLocaleString("en-US")} subscribers inside ten minutes. Between the event and the inbox sit preferences, quiet hours, a queue, workers that crash, a provider that rate-limits, and bounces and spam complaints that decide whether your next email arrives at all.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Your app, a notification service, a queue, send workers, an email provider and the recipient's inbox, with bounce webhooks coming back"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "app", label: "Your app", sub: `${ALERTS} alerts`, at: [10, 22], mobileAt: [22, 8], state: "active" },
                  { id: "notify", label: "Notifications", sub: s.preferences ? "prefs · quiet hours" : "sends to all", at: [42, 22], mobileAt: [72, 8], state: "active" },
                  { id: "queue", label: "Queue", sub: `${n(r.afterDigest)} msgs`, at: [74, 22], mobileAt: [72, 40], state: "idle" },
                  { id: "worker", label: "Workers", sub: s.dedupe ? "idempotent" : "at least once", at: [74, 78], mobileAt: [22, 40], state: s.dedupe ? "good" : "active" },
                  { id: "provider", label: "Email provider", sub: `${PROVIDER_RATE}/s`, at: [42, 78], mobileAt: [22, 72], state: r.reputation === "throttled" ? "bad" : "active" },
                  { id: "inbox", label: "Inbox", sub: `${n(r.sent)} emails`, at: [10, 78], mobileAt: [72, 92], state: r.unwanted ? "wait" : "good" },
                ]}
                links={[
                  { from: "app", to: "notify", label: "event" },
                  { from: "notify", to: "queue", label: "messages" },
                  { from: "queue", to: "worker", label: "pull" },
                  { from: "worker", to: "provider", label: "send" },
                  { from: "provider", to: "inbox", label: "deliver" },
                  { from: "provider", to: "notify", label: "bounces", dashed: true },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" aria-label="Totals for this incident">
                <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  <Stat label="emails sent" value={n(r.sent)} />
                  <Stat label="unwanted" value={n(r.unwanted)} bad={r.unwanted > 0} />
                  <Stat label="duplicates" value={n(r.duplicates)} bad={r.duplicates > 0} />
                  <Stat label="reputation" value={r.reputation} bad={r.reputation !== "good"} />
                </dl>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Sending…">
                Send the alerts
              </RunButton>
              <button type="button" onClick={() => setS(ALL)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm">
                All on
              </button>
              <button type="button" onClick={() => setS(NONE)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm">
                All off
              </button>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Turn an event into messages, once" what="Your app emits one event per alert; a notification service owns who gets what. Keeping that out of the app means one place for preferences, templates and channels (email, push, SMS)." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  {ALERTS} alerts × {USERS.toLocaleString("en-US")} subscribers = {n(r.intended)} possible emails
                </p>
              </FlowStep>
              <FlowArrow label="who, and when" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Respect preferences, quiet hours and batching" what={`${Math.round(OPTED_OUT * 100)}% of subscribers turned these alerts off. ${Math.round(QUIET_HOURS * 100)}% are asleep in their time zone. Three alerts about one incident read better as one digest. Every email you don't send is one nobody marks as spam.`} accent={ACCENT} active={at(1)}>
                <Toggle checked={s.preferences} onChange={(v) => set("preferences", v)} label="Honour notification preferences" />
                <Toggle checked={s.quietHours} onChange={(v) => set("quietHours", v)} label="Hold until morning in quiet hours" />
                <Toggle checked={s.digest} onChange={(v) => set("digest", v)} label="One digest per incident" />
                <p className="font-mono text-xs">
                  {n(r.intended)} → {n(r.afterPreferences)} after preferences → {n(r.afterDigest)} now{r.deferred ? ` + ${n(r.deferred)} later` : ""}
                </p>
              </FlowStep>
              <FlowArrow label="messages" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Queue it, and send each message once" what={`Workers pull from a queue that delivers at least once. If a worker crashes after the provider accepted a message but before acknowledging it (${Math.round(REDELIVERY * 100)}% here), the message comes back. Sending with an idempotency key (alert, user, channel) makes the second attempt a no-op.`} accent={ACCENT} active={at(2)}>
                <Toggle checked={s.dedupe} onChange={(v) => set("dedupe", v)} label="Idempotency key per alert, user and channel" />
                <p className="font-mono text-xs" style={{ color: r.duplicates ? "var(--bad)" : "var(--good)" }}>
                  {n(r.duplicates)} duplicate emails
                </p>
              </FlowStep>
              <FlowArrow label="sends" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Stay under the provider's rate" what={`The provider accepts ${PROVIDER_RATE} emails a second on this account. Push harder and ${Math.round(THROTTLED_SHARE * 100)}% come back as 429 Too Many Requests; dropped, they're lost. Retried with exponential backoff and jitter, they go out a little later.`} accent={ACCENT} active={at(3)}>
                <Toggle checked={s.backoff} onChange={(v) => set("backoff", v)} label="Retry 429s and 5xx with backoff" />
                <p className="font-mono text-xs">
                  {r.minutes.toFixed(1)} minutes to send · {n(r.failedThrottle)} lost to rate limiting
                </p>
              </FlowStep>
              <FlowArrow label="what comes back" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Listen to bounces and complaints" what={`${Math.round(BAD_ADDRESSES * 100)}% of addresses don't exist. Providers report bounces and spam complaints by webhook; above roughly ${Math.round(MAX_BOUNCE * 100)}% bounces or ${pct(MAX_COMPLAINT, 1)} complaints they throttle or suspend you, and then the important emails stop arriving too. A suppression list stops you mailing a bad address twice.`} accent={ACCENT} active={at(4)}>
                <Toggle checked={s.suppression} onChange={(v) => set("suppression", v)} label="Suppress addresses that bounced" />
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">bounces</span>
                  <span className="text-right text-[var(--faint)]">complaints</span>
                  <Row cells={["this incident", pct(r.bounceRate), pct(r.complaintRate, 2)]} rep={r.reputation} />
                  <Row cells={["the next one", pct(next.bounceRate), pct(next.complaintRate, 2)]} rep={next.reputation} />
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Rates are illustrative; the thresholds are in the range providers publish. Push and SMS follow the same pipeline with different providers and limits.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, rep }: { cells: string[]; rep: keyof typeof REP_COLOR }) {
  return (
    <>
      <span className="font-sans">
        {cells[0]} <span style={{ color: REP_COLOR[rep] }}>({rep})</span>
      </span>
      <span className="text-right">{cells[1]}</span>
      <span className="text-right">{cells[2]}</span>
    </>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
      {label}
    </label>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="flex flex-col-reverse rounded-md bg-[var(--inset)] px-2 py-2">
      <dt className="text-[11px] text-[var(--muted)]">{label}</dt>
      <dd className="font-mono text-sm" style={{ color: bad ? "var(--bad)" : "var(--text)" }}>
        {value}
      </dd>
    </div>
  );
}
