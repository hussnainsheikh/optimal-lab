"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { CASES, chain, type Case } from "@/lib/certChain";

const ACCENT = "var(--sec)";

export default function CertChainDemo() {
  const [c, setC] = useState<Case>("valid");
  const r = chain(c);
  return (
    <SessionPage>
      <SessionHeader kicker="Security · interactive" title="Certificates and the chain of trust" blurb="Your browser trusts a few hundred root authorities. A site's certificate is trusted only if it links back to one of them through signatures, is in date, and names the site you asked for. Break one link and you get the red warning page." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Certificate chain and checks">
              <p className="font-mono text-xs text-[var(--muted)]">https://shop.example.com</p>
              <ol className="mt-3 space-y-1">
                {[...r.certs].reverse().map((ct, i) => (
                  <li key={ct.role}>
                    {i > 0 && <p className="pl-4 text-xs text-[var(--faint)]">↓ signs</p>}
                    <div className="rounded-lg border-2 p-2" style={{ borderColor: ct.role === "intermediate" && !ct.sent ? "var(--bad)" : ct.role === "root" ? "var(--good)" : "var(--line)", borderStyle: ct.role === "intermediate" && !ct.sent ? "dashed" : "solid" }}>
                      <p className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">{ct.subject}</span><span className="font-mono text-[11px] text-[var(--muted)]">{ct.role}</span></p>
                      <p className="font-mono text-[11px] text-[var(--muted)]">issued by {ct.issuer} · valid until <span style={{ color: ct.until < "2026-10-13" ? "var(--bad)" : undefined }}>{ct.until}</span></p>
                      <p className="text-[11px] text-[var(--faint)]">{ct.role === "root" ? "already in the browser's trust store" : ct.sent ? "sent by the server" : "NOT sent by the server"}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <ul className="mt-4 space-y-1.5">{r.checks.map((k) => <li key={k.name} className="text-sm"><span style={{ color: k.ok ? "var(--good)" : "var(--bad)" }}>{k.ok ? "✓" : "✗"}</span> {k.name}<p className="pl-4 text-xs text-[var(--muted)]">{k.why}</p></li>)}</ul>
              <p className="mt-3 rounded-lg p-2 text-center font-mono text-sm" style={{ background: r.error ? "var(--bad)" : "var(--good)", color: "var(--on-accent)" }}>{r.error ?? "Connection is secure"}</p>
            </section>
          }
          panel={<SystemMapPanel caption={c === "valid" ? "Every link checks out: the leaf is signed by R11, R11 by a root the browser already trusts, dates are fine and the name matches." : c === "missing-intermediate" ? "A classic misconfiguration: the server only sends its own certificate. Some clients fetch the missing one, many don't. Serve the full chain." : r.checks.find((k) => !k.ok)!.why}><Choices label="Scenario" accent={ACCENT} value={c} onChange={setC} options={CASES} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="A certificate binds a name to a key" what="It says “this public key belongs to shop.example.com”, signed by an authority that checked." accent={ACCENT}><p className="text-sm text-[var(--muted)]">The server proves it has the private key in the TLS handshake.</p></FlowStep>
              <FlowArrow label="who vouches" accent={ACCENT} />
              <FlowStep n={2} title="Chains end at a trusted root" what="Roots sign intermediates (kept offline), intermediates sign site certificates. The server must send the intermediates." accent={ACCENT} active={c === "missing-intermediate" || c === "self-signed"}><p className="font-mono text-xs">openssl s_client -showcerts -connect host:443</p></FlowStep>
              <FlowArrow label="and" accent={ACCENT} />
              <FlowStep n={3} title="Dates and names must match" what="Expired certificates and names missing from the Subject Alternative Name list are rejected." accent={ACCENT} active={c === "expired" || c === "hostname"}><p className="text-sm text-[var(--muted)]">Wildcards cover one label: *.example.com.</p></FlowStep>
              <FlowArrow label="operate it" accent={ACCENT} />
              <FlowStep n={4} title="Automate renewal" what="Let's Encrypt certificates last 90 days (and are getting shorter). Use ACME clients or cert-manager, and alert well before expiry." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Expired certs still cause big outages.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
