"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { ATTEMPT_LABEL, POSITION, PROTECTION, attempts, best, needsVigilance, outcome, safety, type Attempt, type Position, type Protection } from "@/lib/mitm";

const ACCENT = "var(--net)";

type Opts = { position: Position; protection: Protection; attempt: Attempt };
const WEAK: Opts = { position: "rogueAp", protection: "http", attempt: "pass" };
const STRONG: Opts = { position: "rogueAp", protection: "hsts", attempt: "fakeCert" };
const POSITIONS: Position[] = ["rogueAp", "arpSpoof", "dnsSpoof"];
const PROTECTIONS: Protection[] = ["http", "https", "hsts", "pinned"];
const SAFETY_COLOR = { exposed: "var(--bad)", metadata: "var(--c2)", safe: "var(--good)" } as const;
const SAFETY_LABEL = { exposed: "Contents exposed", metadata: "Only metadata leaks", safe: "Interception caught" } as const;

export default function MitmDemo() {
  const [o, setO] = useState<Opts>(WEAK);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const avail = attempts(o.protection);
  const attempt = avail.includes(o.attempt) ? o.attempt : avail[0];
  const out = outcome(o.protection, attempt);
  const s = safety(o.protection);

  const nodes: MapNode[] = [
    { id: "user", label: "You", sub: `on ${POSITION[o.position].where}`, at: [11, 50], mobileAt: [50, 7], state: "active" },
    { id: "mitm", label: "In the middle", sub: POSITION[o.position].label, at: [40, 50], mobileAt: [50, 35], state: out.caught ? "dim" : out.canChange ? "bad" : "wait" },
    { id: "ca", label: "Certificate check", sub: o.protection === "http" ? "no TLS" : out.caught && attempt !== "strip" ? "rejects the fake" : "", at: [63, 16], mobileAt: [80, 62], state: o.protection === "http" ? "dim" : out.caught && attempt !== "strip" ? "good" : "idle" },
    { id: "server", label: "shop.example.com", sub: PROTECTION[o.protection].short, at: [88, 50], mobileAt: [50, 90], state: "good" },
  ];
  const stops = out.caught ? "mitm" : "server";
  const packets: Packet[] =
    stage === 0 ? hops("r", ["user", "mitm"], { label: "request", tone: "accent" })
    : stage === 1 ? hops("i", ["user", "mitm"], { label: POSITION[o.position].label, tone: "bad" })
    : stage === 2 ? (o.protection === "http" ? hops("c", ["mitm", "user"], { label: "reads it all", tone: "bad" }) : hops("c", ["mitm", "ca"], { label: attempt === "strip" ? "downgrade to HTTP" : "fake certificate", tone: "bad" }))
    : stage === 3 ? (out.caught ? hops("x", ["ca", "user"], { label: "blocked", tone: "good" }) : hops("f", ["user", "mitm", stops === "server" ? "server" : "mitm"], { label: out.canChange ? "altered" : "encrypted", tone: out.canChange ? "bad" : "good" }))
    : stage === 4 ? hops("d", ["user", "mitm", "server"], { label: out.caught ? "safe" : out.canChange ? "compromised" : "private", tone: out.caught || !out.canChange ? "good" : "bad" })
    : [];

  const captions = [
    `Step 1: ${POSITION[o.position].how}`,
    `Step 2: now every packet between you and the site passes through the attacker's machine.`,
    o.protection === "http" ? "Step 3: with no encryption, the attacker reads and can rewrite the page, your login and your session cookie." : attempt === "strip" ? "Step 3: the attacker tries to serve the site over plain HTTP so there's nothing to decrypt." : attempt === "read" ? "Step 3: the traffic is encrypted, so the attacker sees only the destination and the amount of data." : "Step 3: to read HTTPS, the attacker must present its own certificate for the site.",
    out.caught ? `Step 4: caught. ${out.by}` : out.canChange ? "Step 4: not caught: the attacker can read and change the traffic." : "Step 4: the attacker is stuck with encrypted bytes and the destination name.",
    `Step 5: ${out.userSees}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${PROTECTION[o.protection].label} against ${POSITION[o.position].label}: ${SAFETY_LABEL[s].toLowerCase()}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="Man-in-the-middle attacks"
        blurb="If someone controls the network path, they sit between you and the server and can read or change anything sent in the clear. TLS is built to make that position worthless: the server proves who it is, so an attacker who can't forge that proof is left with encrypted noise. Take the middle position and see what each defence leaves you with."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="An attacker on the network path sits between a user and a server, with a certificate check in between"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "user", to: "mitm", label: "path" },
                  { from: "mitm", to: "ca", label: "cert", dim: o.protection === "http" },
                  { from: "mitm", to: "server", label: "upstream", dim: out.caught },
                ]}
                packets={packets}
                aspect={1.7}
                mobileAspect={0.8}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="What the attacker ends up with">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Result</p>
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${SAFETY_COLOR[s]} 18%, transparent)`, color: SAFETY_COLOR[s] }}>
                    {SAFETY_LABEL[s]}
                  </span>
                </div>
                <dl className="mt-2 space-y-1 text-xs">
                  <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                    <dt className="text-[var(--faint)]">Attacker sees</dt>
                    <dd style={{ color: out.canChange ? "var(--bad)" : out.caught ? "var(--good)" : "var(--c2)" }}>{out.sees}</dd>
                  </div>
                  <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                    <dt className="text-[var(--faint)]">Can alter it</dt>
                    <dd style={{ color: out.canChange ? "var(--bad)" : "var(--good)" }}>{out.canChange ? "yes" : "no"}</dd>
                  </div>
                  <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                    <dt className="text-[var(--faint)]">You see</dt>
                    <dd>{out.userSees}</dd>
                  </div>
                  {out.by && (
                    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                      <dt className="text-[var(--faint)]">Caught by</dt>
                      <dd className="text-[var(--good)]">{out.by}</dd>
                    </div>
                  )}
                </dl>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO({ ...WEAK, position: o.position })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Plain HTTP
                </button>
                <button type="button" onClick={() => setO({ ...STRONG, position: o.position })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  HTTPS + HSTS
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Intercepting…">
                Intercept the traffic
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Get onto the path" what="A man-in-the-middle needs to sit between you and the server. On open or shared networks that's achievable: a fake access point you join by mistake, a lie about who the router is, or a forged DNS answer that beats the real one." accent={ACCENT} active={at(0)}>
                <Choices<Position> accent={ACCENT} value={o.position} onChange={(v) => set({ position: v })} options={POSITIONS.map((id) => ({ id, label: POSITION[id].label }))} />
                <p className="text-xs text-[var(--muted)]">{POSITION[o.position].how}</p>
              </FlowStep>
              <FlowArrow label="traffic flows through them" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="See what's protecting the site" what="Being on the path only helps if the traffic is readable. Plain HTTP is wide open. HTTPS encrypts it, but if the first visit happens over HTTP the attacker can try to keep it there. HSTS tells browsers to never use HTTP for the site; pinning tells an app to trust only one specific key." accent={ACCENT} active={at(1)}>
                <Choices<Protection> accent={ACCENT} value={o.protection} onChange={(v) => set({ protection: v, attempt: attempts(v)[0] })} options={PROTECTIONS.map((id) => ({ id, label: PROTECTION[id].label }))} />
                <p className="text-xs text-[var(--muted)]">{PROTECTION[o.protection].short}</p>
              </FlowStep>
              <FlowArrow label="the attacker tries something" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Try to read or change it" what="From the middle, the attacker can forward traffic untouched, try to read it, downgrade HTTPS to HTTP, or present its own certificate to pose as the server. Each of these runs into a different defence." accent={ACCENT} active={at(2)}>
                <Choices<Attempt> accent={ACCENT} value={attempt} onChange={(v) => set({ attempt: v })} options={avail.map((id) => ({ id, label: ATTEMPT_LABEL[id] }))} />
              </FlowStep>
              <FlowArrow label="the defence responds" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Hit the defence" what="A forged certificate fails because no trusted authority will sign one for a name the attacker doesn't control, so the browser shows a full-page warning. HSTS makes the downgrade impossible. Pinning rejects even a validly signed certificate that isn't the expected one. Only plain HTTP, or a user who clicks past a warning, lets the attacker win." accent={ACCENT} active={at(3)}>
                <p className="text-sm" style={{ color: out.caught ? "var(--good)" : out.canChange ? "var(--bad)" : "var(--c2)" }}>
                  {out.caught ? `✓ Caught — ${out.by}` : out.canChange ? "✕ The attacker can read and change the traffic" : "~ The attacker gets only the destination and timing"}
                </p>
              </FlowStep>
              <FlowArrow label="the net result" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Compare the defences" what="Encryption alone turns full interception into metadata. HSTS and pinning close the last gaps that rely on a downgrade or a forged certificate. The one weak spot left is a person clicking through a certificate warning, which is why HSTS removes even that choice for important sites." accent={ACCENT} active={at(4)}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[17rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 text-left font-normal">protection</th>
                        <th className="py-1 text-left font-normal">best the attacker does</th>
                        <th className="py-1 text-right font-normal">result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PROTECTIONS.map((p) => {
                        const bb = best(p);
                        const ss = safety(p);
                        return (
                          <tr key={p} className="border-t border-[var(--line)]" style={{ fontWeight: p === o.protection ? 600 : 400 }}>
                            <td className="py-1 text-[var(--muted)]">{PROTECTION[p].label}</td>
                            <td className="py-1">{bb.o.caught ? "nothing" : bb.o.canChange ? "read + alter" : "metadata only"}</td>
                            <td className="py-1 text-right" style={{ color: SAFETY_COLOR[ss] }}>{SAFETY_LABEL[ss]}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {needsVigilance(o.protection) && <p className="text-xs text-[var(--c2)]">HTTPS without HSTS still relies on the user noticing a missing padlock or clicking away from a warning.</p>}
                <p className="mt-2 text-[11px] text-[var(--faint)]">This page is about why the defences work, not how to intercept anyone. The outcomes follow how TLS, HSTS and pinning behave; the example site and the descriptions are illustrative. Related: the TLS handshake and certificates sessions.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
