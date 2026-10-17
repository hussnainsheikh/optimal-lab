"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { HEADER, MAX_AGE_DAYS, SETUPS, visit, type Setup } from "@/lib/hsts";

const ACCENT = "var(--sec)";

export default function HstsDemo() {
  const [setup, setSetup] = useState<Setup>("redirect");
  const [firstVisit, setFirstVisit] = useState(false);
  const [days, setDays] = useState(30);
  const walk = useWalk(5, 1000);
  const stage = walk.stage;
  const r = visit(setup, firstVisit, days);
  const hasRedirect = !r.known && setup !== "http-only";
  const done = stage === null;
  const seen = (s: number) => done || (stage !== null && stage >= s);

  const packets: Packet[] =
    stage === 2 ? hops(`first-${setup}-${firstVisit}-${days}`, ["browser", "wifi", "bank"], { label: r.known ? "https GET" : "http GET", tone: r.known ? "good" : "bad" })
    : stage === 3 && hasRedirect ? hops(`redir-${setup}`, ["bank", "wifi", "browser"], { label: "301 → https", tone: "bad" })
    : stage === 3 && setup === "http-only" ? hops(`login-${setup}`, ["browser", "wifi", "bank"], { label: "password", tone: "bad" })
    : stage === 4 && r.remembers ? hops(`hsts-${setup}`, ["bank", "wifi", "browser"], { label: "HSTS header", tone: "good" })
    : [];

  const caption =
    stage === null ? (r.exposed ? `Exposed: ${r.risk}` : `Safe: ${r.risk}`)
    : stage === 0 ? "The visitor types bank.example, with no http:// or https://."
    : stage === 1 ? (r.known ? `The browser already knows: ${r.knownWhy}` : `Nothing on file. ${r.knownWhy}`)
    : stage === 2 ? (r.known ? "The first request is already HTTPS. Nothing readable crosses the Wi-Fi." : "The first request goes out as plain HTTP. Whoever runs the Wi-Fi can read and change it.")
    : stage === 3 ? (hasRedirect ? "The site answers with a redirect to HTTPS, but that answer is plain too: an attacker can drop it and serve a fake HTTP page instead." : setup === "http-only" ? "No redirect: the login form and password go over plain HTTP." : "No redirect needed.")
    : r.remembers ? `The HTTPS response carries the HSTS header. For the next ${MAX_AGE_DAYS} days this browser will never try HTTP for bank.example.` : "No HSTS header, so the browser learns nothing. Next visit starts with plain HTTP again.";

  return (
    <SessionPage>
      <SessionHeader
        kicker="Security · interactive"
        title="HTTPS everywhere and HSTS"
        blurb="A site that redirects HTTP to HTTPS still has one plain request: the first. On café Wi-Fi that is enough for someone to keep the visitor on a fake HTTP page. HSTS tells the browser to skip HTTP entirely, and the preload list covers even the first visit. Pick a setup, set when the visitor last came, and run the visit."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="min-w-0 space-y-3">
              <SystemMap
                chrome="split"
                title="A browser on café Wi-Fi visiting bank.example"
                accent={ACCENT}
                nodes={[
                  { id: "browser", label: "Browser", sub: r.known ? "HSTS: on file" : "HSTS: nothing", at: [13, 50], mobileAt: [50, 13], state: stage === 0 || stage === 1 ? "active" : done ? (r.exposed ? "bad" : "good") : "idle" },
                  { id: "wifi", label: "Café Wi-Fi", sub: seen(2) && r.exposed ? "read the plain request" : "sees only TLS", at: [50, 50], state: seen(2) && r.exposed ? "bad" : "idle" },
                  { id: "bank", label: "bank.example", sub: setup === "http-only" ? "HTTP only" : r.remembers ? "sends HSTS" : "redirects", at: [87, 50], mobileAt: [50, 87], state: stage !== null && stage >= 2 ? "active" : "idle" },
                ]}
                links={[
                  { from: "browser", to: "wifi", label: r.known ? "https" : "http" },
                  { from: "wifi", to: "bank", label: r.known ? "https" : "http" },
                ]}
                packets={packets}
                aspect={2.6}
                mobileAspect={0.9}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 sm:p-4" aria-label="Requests on the wire">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">On the wire</p>
                <ol className="mt-2 space-y-1.5">
                  {r.wire.map((w, i) => (
                    <li key={i} className="min-w-0 rounded-md border-l-2 bg-[var(--inset)] px-2 py-1.5" style={{ borderColor: w.plain ? "var(--bad)" : "var(--good)", opacity: seen(2 + i) ? 1 : 0.35 }}>
                      <p className="break-all font-mono text-xs" style={{ color: w.plain ? "var(--bad)" : undefined }}>{w.line}</p>
                      <p className="text-[11px] text-[var(--muted)]">{w.plain ? "plain: readable and changeable" : "encrypted"} · {w.note}</p>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="What bank.example does" accent={ACCENT} value={setup} onChange={setSetup} options={SETUPS} />
              <RunButton busy={walk.busy} onClick={walk.run} accent={ACCENT} running="Visiting…">
                Run the visit
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Type the address" what="Most people type bank.example or follow an old http:// link. Without a scheme, the browser has to pick one." accent={ACCENT} active={stage === 0}>
                <p className="font-mono text-sm">bank.example ⏎</p>
              </FlowStep>
              <FlowArrow label="a bare host name" accent={ACCENT} active={stage === 1} />
              <FlowStep n={2} title="Check the HSTS list" what="The browser looks for a saved HSTS entry for this site, or a built-in preload entry." accent={ACCENT} active={stage === 1}>
                <Choices accent={ACCENT} value={firstVisit ? "first" : "returning"} onChange={(v) => setFirstVisit(v === "first")} options={[{ id: "first", label: "First visit" }, { id: "returning", label: "Been here before" }]} />
                {!firstVisit && (
                  <div className="mt-3">
                    <Slider label="Days since the last visit" value={days} min={1} max={500} step={1} format={(v) => `${v} d`} onChange={setDays} accent={ACCENT} hint={`max-age is ${MAX_AGE_DAYS} days`} />
                  </div>
                )}
                <p className="mt-2 text-sm" style={{ color: r.known ? "var(--good)" : "var(--muted)" }}>{r.knownWhy}</p>
              </FlowStep>
              <FlowArrow label={r.known ? "https:// (upgraded inside the browser)" : "http://"} accent={ACCENT} active={stage === 2} />
              <FlowStep n={3} title="Send the first request" what="With an HSTS entry the browser rewrites http to https before sending. Without one, the first request is plain." accent={ACCENT} active={stage === 2}>
                <p className="break-all font-mono text-xs" style={{ color: r.known ? "var(--good)" : "var(--bad)" }}>{r.wire[0].line}</p>
              </FlowStep>
              <FlowArrow label={hasRedirect ? "301 redirect (plain)" : setup === "http-only" ? "login form (plain)" : "page over TLS"} accent={ACCENT} active={stage === 3} />
              <FlowStep n={4} title="Get sent to HTTPS, or not" what="A redirect fixes the visit only if it arrives untouched. Anyone on the path can swap it for a page of their own." accent={ACCENT} active={stage === 3}>
                <p className="text-sm" style={{ color: r.exposed ? "var(--bad)" : "var(--good)" }}>{r.risk}</p>
              </FlowStep>
              <FlowArrow label={r.remembers ? "Strict-Transport-Security" : "no header"} accent={ACCENT} active={stage === 4} />
              <FlowStep n={5} title="Remember to skip HTTP" what="The HSTS header, sent over HTTPS, tells the browser to use only HTTPS for this site for max-age seconds. Every visit refreshes it." accent={ACCENT} active={stage === 4}>
                <p className="break-all font-mono text-xs">{r.remembers ? HEADER : "(no header sent)"}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  includeSubDomains covers every subdomain. preload lets the site join the list built into browsers (hstspreload.org), which protects the very first visit too. Under HSTS, certificate errors can&apos;t be clicked through.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
