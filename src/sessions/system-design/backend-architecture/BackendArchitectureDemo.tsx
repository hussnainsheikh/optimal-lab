"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type NodeState, type Packet } from "@/components/system/SystemMap";
import { NONE, REQUESTS, START_BALANCE, handle, score, type Guards, type Layer } from "@/lib/backendArchitecture";

const ACCENT = "var(--sys)";

export default function BackendArchitectureDemo() {
  const [g, setG] = useState<Guards>(NONE);
  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Backend architecture"
        blurb={`POST /transfers moves money between two accounts, each starting at ${START_BALANCE.sara}. A request passes through authentication middleware, a controller, a service that holds the business rules, the database and an email. Send five requests, four of them wrong in a different way, and decide which layer is responsible for stopping each.`}
      />
      <div className="mt-6">
        <Run key={JSON.stringify(g)} g={g} setG={setG} />
      </div>
    </SessionPage>
  );
}

function Run({ g, setG }: { g: Guards; setG: (g: Guards) => void }) {
  const playback = usePlayback(REQUESTS.length, 2200);
  const req = REQUESTS[playback.i];
  const o = handle(req.id, g);
  const sc = score(g);
  const started = playback.i > 0 || playback.playing;
  const set = (k: keyof Guards, v: boolean) => setG({ ...g, [k]: v });

  const state = (l: Layer): NodeState => {
    if (!o.path.includes(l)) return "dim";
    if (o.stoppedAt === l) return o.correct ? "good" : "bad";
    if (l === "email" && o.emailSent && !o.correct) return "bad";
    return "active";
  };
  const tone = o.correct ? "good" : "bad";
  const packets: Packet[] = started ? hops(`r-${playback.i}-${JSON.stringify(g)}`, ["client", ...o.path], { label: o.status >= 400 ? String(o.status) : req.id === "negative" ? "−50" : "50", tone, step: 0.4 }) : [];

  return (
    <SessionLayout
      visual={
        <div className="space-y-3">
          <SystemMap
            title="A client, the API's auth middleware, controller and transfer service, Postgres, and the email sender (Auth, Controller, Service, Postgres, Email)"
            accent={ACCENT}
            chrome="split"
            nodes={[
              { id: "client", label: "Client", sub: req.id === "ok" ? "transfer" : "bad request", at: [12, 22], mobileAt: [50, 7], state: "active" },
              { id: "middleware", label: "Auth", sub: "who is it?", at: [40, 22], mobileAt: [50, 25], state: state("middleware") },
              { id: "controller", label: "Controller", sub: g.validate ? "schema check" : "parses JSON", at: [68, 22], mobileAt: [50, 43], state: state("controller") },
              { id: "service", label: "Service", sub: g.authorize ? "owns the rules" : "moves money", at: [86, 60], mobileAt: [50, 61], state: state("service") },
              { id: "db", label: "Postgres", sub: g.transaction ? "1 transaction" : "two writes", at: [58, 84], mobileAt: [25, 88], state: state("db") },
              { id: "email", label: "Email", sub: g.outbox ? "via outbox" : "inline", at: [24, 84], mobileAt: [75, 88], state: state("email") },
            ]}
            links={[
              { from: "client", to: "middleware", label: "POST" },
              { from: "middleware", to: "controller", label: "user" },
              { from: "controller", to: "service", label: "command" },
              { from: "service", to: "db", label: "debit, credit" },
              { from: "db", to: "email", label: g.outbox ? "after commit" : "inline", dashed: g.outbox },
            ]}
            packets={packets}
            aspect={1.5}
            mobileAspect={0.95}
          />
          <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" aria-label="Balances after this request">
            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              <Stat label="Sara" value={String(o.balances.sara)} bad={!o.correct && o.balances.sara !== START_BALANCE.sara} />
              <Stat label="Ben" value={String(o.balances.ben)} bad={!o.correct && o.balances.ben !== START_BALANCE.ben} />
              <Stat label="status" value={String(o.status)} />
              <Stat label="handled right" value={`${sc.correct} / ${sc.total}`} bad={sc.correct < sc.total} />
            </div>
          </section>
        </div>
      }
      panel={
        <SystemMapPanel caption={`${req.label}: ${o.note}`}>
          <p className="w-full font-mono text-xs text-[var(--muted)]">{req.body}</p>
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next request" status={`${playback.i + 1} of ${REQUESTS.length}`} />
          <ul className="w-full space-y-0.5 font-mono text-[11px]">
            {REQUESTS.map((r, i) => {
              const x = handle(r.id, g);
              return (
                <li key={r.id} style={{ color: x.correct ? "var(--good)" : "var(--bad)", fontWeight: i === playback.i ? 700 : 400 }}>
                  {x.correct ? "✓" : "✗"} {r.label}: {x.status}
                </li>
              );
            })}
          </ul>
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Authenticate at the edge" what="Middleware runs before any handler and answers one question: who is calling? It turns a token into a user, or returns 401. It can't decide what that user may do; it doesn't know what a transfer is." accent={ACCENT} active={o.path.length <= 2 && o.stoppedAt === null}>
            <p className="font-mono text-xs">every request: token → user · no guard needed, always on</p>
          </FlowStep>
          <FlowArrow label="a known user" accent={ACCENT} />

          <FlowStep n={2} title="Validate the shape in the controller" what="The controller translates HTTP into a command: parse, check the schema (amount > 0, ids are ids), return 400 with field errors if not. Business code downstream can then assume well-formed input." accent={ACCENT} active={o.stoppedAt === "controller"}>
            <Toggle checked={g.validate} onChange={(v) => set("validate", v)} label="Validate the request schema" />
            <Verdict id="negative" g={g} />
          </FlowStep>
          <FlowArrow label="a valid command" accent={ACCENT} />

          <FlowStep n={3} title="Authorize and apply the rules in the service" what="The service owns the business rules, whatever called it: HTTP today, a queue tomorrow. It checks this user may move money from this account, then applies the transfer. Authorization belongs here, next to the data it's about, not in a controller that another entry point can skip." accent={ACCENT} active={o.stoppedAt === "service"}>
            <Toggle checked={g.authorize} onChange={(v) => set("authorize", v)} label="Check the account belongs to the caller" />
            <Verdict id="notYours" g={g} />
          </FlowStep>
          <FlowArrow label="debit and credit" accent={ACCENT} />

          <FlowStep n={4} title="Commit both writes together" what="The service decides the transaction boundary: the debit and the credit commit together or not at all. Without it, a crash between them loses money that no log line will explain." accent={ACCENT} active={req.id === "crash"}>
            <Toggle checked={g.transaction} onChange={(v) => set("transaction", v)} label="One transaction around the transfer" />
            <Verdict id="crash" g={g} />
          </FlowStep>
          <FlowArrow label="then tell people" accent={ACCENT} />

          <FlowStep n={5} title="Send side effects after the commit" what="An email can't be rolled back. Write “send this email” as a row in an outbox table inside the same transaction, and let a relay send it after the commit. If the commit fails, the row was never there." accent={ACCENT} active={req.id === "commitFails" || req.id === "ok"}>
            <Toggle checked={g.outbox} onChange={(v) => set("outbox", v)} label="Transactional outbox for the email" />
            <Verdict id="commitFails" g={g} />
            <p className="mt-2 text-[11px] text-[var(--faint)]">The layers are the common shape of a backend in any language: middleware, handler, service, repository. The sagas session covers the outbox relay in detail; idempotency keys cover the client retrying.</p>
          </FlowStep>
        </>
      }
    />
  );
}

function Verdict({ id, g }: { id: (typeof REQUESTS)[number]["id"]; g: Guards }) {
  const o = handle(id, g);
  return (
    <p className="text-xs" style={{ color: o.correct ? "var(--good)" : "var(--bad)" }}>
      {REQUESTS.find((r) => r.id === id)!.label}: {o.status} · Sara {o.balances.sara}, Ben {o.balances.ben}
      {o.emailSent ? " · email sent" : ""}
    </p>
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
