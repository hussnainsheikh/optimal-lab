"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type NodeState, type Packet } from "@/components/system/SystemMap";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { ALLOWED, CASES, NOW, TRUSTED_CA, checks, clientCert, type Case } from "@/lib/mutualTls";

const ACCENT = "var(--sec)";
/** Which flow step (0-based) each server check belongs to. */
const STEP_OF: Record<string, number> = { present: 2, key: 3, chain: 3, dates: 3, authz: 4 };

export default function MutualTlsDemo() {
  const [c, setC] = useState<Case>("valid");
  const walk = useWalk(5, 1000);
  const stage = walk.stage;
  const cert = clientCert(c);
  const r = checks(c);
  const failStep = r.failedAt === null ? null : STEP_OF[r.list[r.failedAt].id];
  const reached = (s: number) => stage === null || stage >= s;
  const stopped = failStep !== null && stage !== null && stage > failStep;
  const finished = stage === null;

  const packets: Packet[] =
    stage === 0 ? hops(`srv-${c}`, ["payments", "orders"], { label: "server cert" })
    : stage === 1 ? hops(`req-${c}`, ["payments", "orders"], { label: "send your cert" })
    : stage === 2 ? hops(`cli-${c}`, ["orders", "payments"], { label: cert ? "cert + signature" : "no cert", tone: cert ? "accent" : "bad" })
    : stage === 3 && !stopped ? hops(`chk-${c}`, ["ca", "payments"], { label: "CA public key" })
    : stage === 4 && !stopped ? hops(`call-${c}`, ["orders", "payments"], { label: "POST /charge", tone: r.failedAt === null ? "good" : "bad" })
    : [];

  const outcomeState: NodeState = r.failedAt === null ? "good" : "bad";
  const caption =
    stage === null
      ? `${r.status}.${r.failedAt !== null ? ` Stopped at: ${r.list[r.failedAt].label.toLowerCase()}.` : ""}`
      : stopped
        ? `Stopped: ${r.list[r.failedAt!].detail}`
        : stage === 0 ? "The payments API sends its certificate, like any HTTPS server. The orders service checks it."
        : stage === 1 ? `Then it asks the caller for a certificate signed by ${TRUSTED_CA}.`
        : stage === 2 ? (cert ? `The orders service sends ${cert.subject} and signs the handshake with its private key.` : "The caller has no certificate to send.")
        : stage === 3 ? "The server checks the chain, the dates and the signature."
        : r.failedAt === 4 ? "The handshake worked, so the caller is known. But it isn't allowed to charge cards: 403." : "Known caller, allowed action: the charge goes through.";

  return (
    <SessionPage>
      <SessionHeader
        kicker="Security · interactive"
        title="Mutual TLS"
        blurb="In normal HTTPS only the server shows a certificate. In mutual TLS the client shows one too, so two services can prove who they are to each other without passwords or API keys. Pick a caller and run the handshake: each check either passes or closes the connection."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="min-w-0 space-y-3">
              <SystemMap
                chrome="split"
                title="The orders service calls the payments API; both trust the internal CA"
                accent={ACCENT}
                nodes={[
                  { id: "orders", label: "Caller", sub: cert ? cert.subject.replace("spiffe://shop.internal/", "") : "no cert", at: [14, 68], mobileAt: [24, 78], state: stage === 2 || stage === 4 ? "active" : finished && r.failedAt !== null && r.failedAt < 4 ? "bad" : "idle" },
                  { id: "payments", label: "Payments API", sub: stage === null ? (r.failedAt === null ? "200 OK" : r.failedAt === 4 ? "403" : "closed") : "checking", at: [86, 68], mobileAt: [76, 78], state: stage === null ? outcomeState : stage === 3 ? "active" : "idle" },
                  { id: "ca", label: "Internal CA", sub: "signs service certs", at: [50, 18], mobileAt: [50, 18], state: stage === 3 ? "active" : "idle" },
                ]}
                links={[
                  { from: "orders", to: "payments", label: "TLS" },
                  { from: "ca", to: "payments", label: "trusted root", dashed: true, active: stage === 3 },
                  { from: "ca", to: "orders", dashed: true, dim: c === "untrusted" || c === "none" },
                ]}
                packets={packets}
                aspect={2.2}
                mobileAspect={1.15}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 sm:p-4" aria-label="The server's checks">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Payments API checks the caller</p>
                <ul className="mt-2 space-y-1.5">
                  {r.list.map((x) => {
                    const show = reached(STEP_OF[x.id]);
                    const mark = !show || x.pass === null ? "·" : x.pass ? "✓" : "✗";
                    const color = !show || x.pass === null ? "var(--faint)" : x.pass ? "var(--good)" : "var(--bad)";
                    return (
                      <li key={x.id} className="flex min-w-0 gap-2 rounded-md bg-[var(--inset)] px-2 py-1.5 text-sm">
                        <span className="w-4 shrink-0 font-mono" style={{ color }}>{mark}</span>
                        <span className="min-w-0">
                          <span style={{ color: show && x.pass === false ? "var(--bad)" : undefined }}>{x.label}</span>
                          {show && x.pass !== null && x.detail && <span className="block break-words text-xs text-[var(--muted)]">{x.detail}</span>}
                          {show && x.pass === null && <span className="block text-xs text-[var(--faint)]">not reached</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Who is calling" accent={ACCENT} value={c} onChange={setC} options={CASES} />
              <RunButton busy={walk.busy} onClick={walk.run} accent={ACCENT} running="Handshaking…">
                Run the handshake
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Show the server's certificate" what="The first half is ordinary TLS: the payments API proves it is payments.shop.internal." accent={ACCENT} active={stage === 0}>
                <p className="font-mono text-xs">payments.shop.internal · issued by {TRUSTED_CA}</p>
              </FlowStep>
              <FlowArrow label="CertificateRequest" accent={ACCENT} active={stage === 1} />
              <FlowStep n={2} title="Ask the caller for a certificate" what="The server says which CAs it accepts. A server that requires a certificate ends the handshake if none comes back." accent={ACCENT} active={stage === 1}>
                <p className="font-mono text-xs">accepted: {TRUSTED_CA}</p>
              </FlowStep>
              <FlowArrow label={cert ? "Certificate + CertificateVerify" : "empty Certificate"} accent={ACCENT} active={stage === 2} />
              <FlowStep n={3} title="Send the certificate and a signature" what="The certificate is public. The signature over the handshake proves the caller holds the matching private key." accent={ACCENT} active={stage === 2}>
                {cert ? (
                  <ul className="space-y-0.5 break-all font-mono text-xs">
                    <li>subject: {cert.subject}</li>
                    <li>issuer: {cert.issuer}</li>
                    <li>not after: {cert.notAfter}</li>
                    <li style={{ color: cert.hasKey ? undefined : "var(--bad)" }}>signature: {cert.hasKey ? "made with the private key" : "missing: no private key"}</li>
                  </ul>
                ) : (
                  <p className="text-sm" style={{ color: "var(--bad)" }}>Nothing to send.</p>
                )}
              </FlowStep>
              <FlowArrow label="the caller's identity" accent={ACCENT} active={stage === 3} />
              <FlowStep n={4} title="Check the chain, dates and proof" what={`The server checks the certificate was signed by ${TRUSTED_CA}, is valid on ${NOW}, and that the signature matches its public key.`} accent={ACCENT} active={stage === 3}>
                <p className="text-xs text-[var(--muted)]">Internal certificates usually live hours or days, renewed automatically, so a leaked one expires quickly.</p>
              </FlowStep>
              <FlowArrow label={r.failedAt !== null && r.failedAt < 4 ? "connection closed" : "POST /charge"} accent={ACCENT} active={stage === 4} />
              <FlowStep n={5} title="Decide what this caller may do" what="Knowing who is calling is authentication. Whether that service may charge cards is a separate check on its identity." accent={ACCENT} active={stage === 4}>
                <p className="break-all font-mono text-xs text-[var(--muted)]">allowed: {ALLOWED.join(", ")}</p>
                <p className="mt-1 text-sm" style={{ color: r.failedAt === null ? "var(--good)" : "var(--bad)" }}>{r.status}</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
