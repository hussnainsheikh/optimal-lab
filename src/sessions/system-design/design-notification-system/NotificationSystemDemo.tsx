"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { AUDIENCES, CHANNELS, ERROR_5XX, OPTED_OUT, QUEUES, QUIET, RESET_AT, TIMEOUT_DELIVERED, audience, drain, dur, fmt, resetWait, retries, type QueueDesign } from "@/lib/notificationSystem";

const ACCENT = "var(--sys)";
const COLOR = { push: "var(--c1)", email: "var(--c3)", sms: "var(--c2)" } as const;

export default function NotificationSystemDemo() {
  const [users, setUsers] = useState(10e6);
  const [q, setQ] = useState<QueueDesign>("shared");
  const [dedupe, setDedupe] = useState(false);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const a = audience(users);
  const d = drain(users, q);
  const wait = resetWait(users, q);
  const rt = retries(users, dedupe);

  const packets: Packet[] =
    stage === 0 ? hops("e", ["trigger", "notif"], { label: `campaign · ${fmt(users)}` })
    : stage === 1 ? hops("p", ["notif", "prefs", "notif"], { label: "who allows what" })
    : stage === 2 ? hops("q", ["notif", "queue"], { label: `${fmt(a.total)} messages` }).concat(CHANNELS.flatMap((c, i) => hops(`w${c.id}`, ["queue", c.id], { label: c.label, start: 0.9 + i * 0.15 })))
    : stage === 3 ? hops("r", ["sms", "queue", "sms"], { label: dedupe ? "retry, same key" : "retry → 2nd SMS", tone: dedupe ? "good" : "bad" })
    : stage === 4 ? hops("t", ["trigger", "notif", "queue", "email"], { label: "password reset", tone: wait < 5 ? "good" : "bad" })
    : [];

  const captions = [
    `Step 1: a campaign to ${fmt(users)} users is one event; the notification service expands it into messages.`,
    `Step 2: ${fmt(a.optedOut)} opted out and ${fmt(a.deferred)} are in quiet hours; ${fmt(a.total)} messages go out now.`,
    `Step 3: ${QUEUES.find((x) => x.id === q)!.label}: push is done in ${dur(d.push)}, email in ${dur(d.email)}, SMS in ${dur(d.sms)}.`,
    `Step 4: ${fmt(rt.retried)} sends are retried; ${dedupe ? "an idempotency key stops duplicates" : `${fmt(rt.duplicates)} people get the same message twice`}.`,
    `Step 5: a password reset requested ${RESET_AT} s in waits ${dur(wait)}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${fmt(a.total)} messages · ${QUEUES.find((x) => x.id === q)!.label}: all sent in ${dur(Math.max(d.push, d.email, d.sms))} · password reset waits ${dur(wait)} · ${fmt(rt.duplicates)} duplicates.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · case study"
        title="Design a notification system"
        blurb="Send push, email and SMS to millions of users, respecting each user's preferences and quiet hours and each provider's rate limit, retrying failures without sending twice, and making sure a password-reset email doesn't wait behind a marketing campaign."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The triggering service, the notification service, preferences, queues and three providers"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "trigger", label: "Your services", sub: "campaign, reset", at: [10, 50], mobileAt: [22, 8], state: "active" },
                  { id: "prefs", label: "Preferences", sub: "opt-outs, quiet hours", at: [34, 13], mobileAt: [78, 8], state: "idle" },
                  { id: "notif", label: "Notification service", sub: "expand + render", at: [34, 62], mobileAt: [50, 32], state: "active" },
                  { id: "queue", label: q === "shared" ? "One queue" : "Queues", sub: q === "priority" ? "+ priority lane" : q === "channel" ? "per channel" : "FIFO", at: [60, 50], mobileAt: [50, 58], state: q === "shared" ? "wait" : "good" },
                  ...CHANNELS.map((c, i) => ({ id: c.id, label: c.provider, sub: `${fmt(c.rate)}/s · ${dur(d[c.id])}`, at: [88, 15 + i * 35] as [number, number], mobileAt: [16 + i * 34, 88] as [number, number], state: "active" as const })),
                ]}
                links={[
                  { from: "trigger", to: "notif", label: "event" },
                  { from: "notif", to: "prefs", label: "lookup" },
                  { from: "notif", to: "queue", label: "messages" },
                  ...CHANNELS.map((c) => ({ from: "queue", to: c.id, label: c.label })),
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.9}
              />
              <Drain users={users} q={q} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Users" accent={ACCENT} value={String(users)} onChange={(v) => setUsers(Number(v))} options={AUDIENCES.map((u) => ({ id: String(u), label: fmt(u) }))} />
              </div>
              <div className="w-full">
                <Choices label="Queues" accent={ACCENT} value={q} onChange={setQ} options={QUEUES.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Sending…">
                Send the campaign
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Accept one event, expand it later" what="Callers send one event (“campaign 31 to all users”, “password reset for user 8”). The notification service owns templates, channels and the fan-out, so no caller loops over 10 million users or knows about SMS providers." accent={ACCENT} active={at(0)}>
                <Choices label="Users" accent={ACCENT} value={String(users)} onChange={(v) => setUsers(Number(v))} options={AUDIENCES.map((u) => ({ id: String(u), label: fmt(u) }))} />
                <p className="mt-2 font-mono text-xs">
                  {fmt(a.total)} messages · ${Math.round(a.cost).toLocaleString("en-US")} in provider fees, ${Math.round(a.per.sms * 0.0079).toLocaleString("en-US")} of it SMS
                </p>
              </FlowStep>
              <FlowArrow label="per user" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Apply preferences and quiet hours" what={`Check what each user agreed to, per channel and per category, before rendering anything: marketing and security alerts are different consents. Hold messages for users in quiet hours rather than dropping them. Here ${OPTED_OUT * 100}% opted out and ${QUIET * 100}% are asleep.`} accent={ACCENT} active={at(1)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">allow</span>
                  <span className="text-right text-[var(--faint)]">messages</span>
                  {CHANNELS.map((c) => (
                    <Row key={c.id} cells={[c.label, `${c.allow * 100}%`, fmt(a.per[c.id])]} />
                  ))}
                </div>
                <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                  {fmt(a.optedOut)} opted out · {fmt(a.deferred)} deferred to morning
                </p>
              </FlowStep>
              <FlowArrow label="messages" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Give each channel its own queue" what="Providers cap your send rate: push is fast, SMS is slow. In one shared queue, workers stuck waiting on SMS tokens hold up the push and email behind them. A queue per channel lets each drain at its own provider's pace." accent={ACCENT} active={at(2)}>
                <Choices label="Queues" accent={ACCENT} value={q} onChange={setQ} options={QUEUES.map((x) => ({ id: x.id, label: x.label }))} />
                <p className="mt-2 text-xs">{QUEUES.find((x) => x.id === q)!.one}</p>
              </FlowStep>
              <FlowArrow label="send" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Retry without sending twice" what={`About ${ERROR_5XX * 100}% of sends fail with a 5xx and are retried with backoff. Worse, ${TIMEOUT_DELIVERED * 100}% time out after the provider already accepted them. Retrying those without an idempotency key sends a second copy, and a second SMS costs money and trust.`} accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Idempotency key per user and notification
                </label>
                <p className="font-mono text-xs" style={{ color: rt.duplicates ? "var(--bad)" : "var(--good)" }}>
                  {fmt(rt.retried)} retried · {fmt(rt.duplicates)} duplicates{rt.duplicates ? ` · $${rt.smsDupCost.toFixed(0)} of repeat SMS` : ""}
                </p>
              </FlowStep>
              <FlowArrow label="meanwhile" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Keep transactional messages ahead" what="A password reset, a one-time code or a payment alert is useless an hour late. Give transactional messages their own lane that workers always drain first, so a campaign can never sit in front of them." accent={ACCENT} active={at(4)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  {QUEUES.map((x) => (
                    <Row key={x.id} cells={[x.label, dur(resetWait(users, x.id))]} on={x.id === q} bad={resetWait(users, x.id) > 60} />
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Wait for a password reset requested {RESET_AT} s into the campaign. Provider limits and prices are typical figures; the shared-queue model assumes messages are interleaved.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, on, bad }: { cells: string[]; on?: boolean; bad?: boolean }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ color: bad && i > 0 ? "var(--bad)" : on === false ? "var(--muted)" : "var(--text)", fontWeight: on ? 600 : 400 }}>
          {c}
        </span>
      ))}
    </>
  );
}

// How long each channel takes to send its share of the campaign.
function Drain({ users, q }: { users: number; q: QueueDesign }) {
  const d = drain(users, q);
  const max = Math.max(...QUEUES.flatMap((x) => Object.values(drain(users, x.id))));
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label={`Time to send: ${CHANNELS.map((c) => `${c.label} ${dur(d[c.id])}`).join(", ")}`}>
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">time until every message is sent</p>
      <ul className="mt-3 space-y-1.5">
        {CHANNELS.map((c) => (
          <li key={c.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)_4rem] items-center gap-2 text-[11px]">
            <span className="text-[var(--muted)]">{c.label}</span>
            <span className="h-3 rounded-sm" style={{ width: `${Math.max(1, (d[c.id] / max) * 100)}%`, background: COLOR[c.id] }} />
            <span className="text-right font-mono">{dur(d[c.id])}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
