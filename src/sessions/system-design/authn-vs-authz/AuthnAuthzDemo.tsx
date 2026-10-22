"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type NodeState, type Packet } from "@/components/system/SystemMap";
import { ALL, NONE, REQUESTS, handle, score, type Checks } from "@/lib/authnAuthz";

const ACCENT = "var(--sys)";

export default function AuthnAuthzDemo() {
  const [c, setC] = useState<Checks>(NONE);
  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Authentication vs authorization"
        blurb={`An invoicing API and seven requests: an admin, members of two teams, nobody, a forged token, and a member who adds “role: admin” to the request. Authentication asks who is calling; authorization asks whether they may do this to this record. Turn on each check and watch which requests stop getting through.`}
      />
      <div className="mt-6">
        <Run key={JSON.stringify(c)} c={c} setC={setC} />
      </div>
    </SessionPage>
  );
}

function Run({ c, setC }: { c: Checks; setC: (c: Checks) => void }) {
  const playback = usePlayback(REQUESTS.length, 2000);
  const r = REQUESTS[playback.i];
  const o = handle(r, c);
  const started = playback.i > 0 || playback.playing;
  const set = (k: keyof Checks, v: boolean) => setC({ ...c, [k]: v });
  const path = o.at === "gateway" ? ["client", "gateway"] : o.at === "service" ? ["client", "gateway", "service"] : ["client", "gateway", "service", "db"];
  const tone = o.correct ? "good" : "bad";
  const packets: Packet[] = started ? hops(`r-${playback.i}`, path, { label: o.status === 200 ? r.action.toUpperCase() : String(o.status), tone, step: 0.45 }) : [];
  const nodeState = (id: string): NodeState => {
    if (!path.includes(id)) return "dim";
    const stopper = o.at === "gateway" ? "gateway" : o.at === "service" ? "service" : "db";
    if (id === stopper) return o.correct ? "good" : "bad";
    return "active";
  };

  return (
    <SessionLayout
      visual={
        <div className="space-y-3">
          <SystemMap
            title="A client, an API gateway that checks tokens, the invoice service that checks permissions, and the database"
            accent={ACCENT}
            chrome="split"
            nodes={[
              { id: "client", label: r.who, sub: r.token === "valid" ? "signed token" : r.token === "forged" ? "forged token" : "no token", at: [12, 50], mobileAt: [50, 8], state: "active" },
              { id: "gateway", label: "Gateway", sub: c.verifySignature ? "verifies signature" : "decodes only", at: [38, 50], mobileAt: [50, 36], state: nodeState("gateway") },
              { id: "service", label: "Invoice service", sub: c.serverAuthz ? "checks permission" : "trusts the UI", at: [64, 50], mobileAt: [50, 64], state: nodeState("service") },
              { id: "db", label: "Invoices", sub: `team ${r.invoiceTeam}'s invoice`, at: [88, 50], mobileAt: [50, 92], state: nodeState("db") },
            ]}
            links={[
              { from: "client", to: "gateway", label: `${r.action.toUpperCase()} /invoices/7` },
              { from: "gateway", to: "service", label: "user + role" },
              { from: "service", to: "db", label: r.action },
            ]}
            packets={packets}
            aspect={2.4}
            mobileAspect={0.85}
          />
          <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" aria-label="Every request and how it was handled">
            <ul className="space-y-0.5 font-mono text-[11px]">
              {REQUESTS.map((x, i) => {
                const y = handle(x, c);
                return (
                  <li key={x.id} className="grid grid-cols-[1rem_2.25rem_minmax(0,1fr)] gap-2" style={{ color: y.correct ? "var(--good)" : "var(--bad)", fontWeight: i === playback.i ? 700 : 400 }}>
                    <span>{y.correct ? "✓" : "✗"}</span>
                    <span>{y.status}</span>
                    <span className="min-w-0">
                      {x.label} <span className="text-[var(--faint)]">(should be {x.shouldBe})</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 font-mono text-xs" style={{ color: score(c) === REQUESTS.length ? "var(--good)" : "var(--bad)" }}>
              {score(c)} of {REQUESTS.length} handled right
            </p>
          </section>
        </div>
      }
      panel={
        <SystemMapPanel caption={`${r.label}: ${o.status}. ${o.why}`}>
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next request" status={`${playback.i + 1} of ${REQUESTS.length}`} />
          <button type="button" onClick={() => setC(ALL)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm">
            All checks on
          </button>
          <button type="button" onClick={() => setC(NONE)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm">
            All off
          </button>
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Authenticate: who is this?" what="A token is only an identity if you check it was issued by you: verify the signature with the issuer's key, the expiry and the audience. Decoding a JWT is not verifying it; anyone can write any claims into one." accent={ACCENT} active={o.at === "gateway"}>
            <Toggle checked={c.verifySignature} onChange={(v) => set("verifySignature", v)} label="Verify the token's signature, expiry and audience" />
            <Verdict id="forged" c={c} />
          </FlowStep>
          <FlowArrow label="a verified user" accent={ACCENT} />

          <FlowStep n={2} title="Authorize on the server, every time" what="Hiding a button is a convenience, not a control. The API must decide for each request whether this user may do this, because anyone can call it without your UI." accent={ACCENT} active={o.at === "service" && r.id === "member-delete"}>
            <Toggle checked={c.serverAuthz} onChange={(v) => set("serverAuthz", v)} label="Check permissions in the service" />
            <Verdict id="member-delete" c={c} />
          </FlowStep>
          <FlowArrow label="their role" accent={ACCENT} />

          <FlowStep n={3} title="Trust only what you verified" what="The role has to come from the signed token or your own database, never from the request body, a header the client sets, or a query parameter. Those are the attacker's to write." accent={ACCENT} active={r.id === "claimed-admin"}>
            <Toggle checked={c.roleFromToken} onChange={(v) => set("roleFromToken", v)} label="Read the role from the verified token" />
            <Verdict id="claimed-admin" c={c} />
          </FlowStep>
          <FlowArrow label="this record" accent={ACCENT} />

          <FlowStep n={4} title="Check the record, not just the role" what="“Members can read invoices” is not the rule; “members can read their team's invoices” is. Each request names a record (invoice 7) and the check has to include it. Skipping this is broken object-level authorization, number one on the OWASP API list." accent={ACCENT} active={r.id === "member-other"}>
            <Toggle checked={c.ownTeamOnly} onChange={(v) => set("ownTeamOnly", v)} label="Members only see their own team's invoices" />
            <Verdict id="member-other" c={c} />
          </FlowStep>
          <FlowArrow label="the answer" accent={ACCENT} />

          <FlowStep n={5} title="Say 401 or 403, and deny by default" what="401 means “I don't know who you are; sign in”. 403 means “I know who you are, and no”. When no rule says yes, the answer is no: a new endpoint someone forgot to protect should fail closed." accent={ACCENT} active={o.status !== 200}>
            <p className="font-mono text-xs">
              401: {REQUESTS.filter((x) => handle(x, c).status === 401).length} · 403: {REQUESTS.filter((x) => handle(x, c).status === 403).length} · 200: {REQUESTS.filter((x) => handle(x, c).status === 200).length}
            </p>
            <p className="mt-2 text-[11px] text-[var(--faint)]">Role-based and attribute-based rules are the next session; the OAuth flow and JWTs have their own sessions in the Security track.</p>
          </FlowStep>
        </>
      }
    />
  );
}

function Verdict({ id, c }: { id: string; c: Checks }) {
  const r = REQUESTS.find((x) => x.id === id)!;
  const o = handle(r, c);
  return (
    <p className="text-xs" style={{ color: o.correct ? "var(--good)" : "var(--bad)" }}>
      {r.label}: {o.status} (should be {r.shouldBe})
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
