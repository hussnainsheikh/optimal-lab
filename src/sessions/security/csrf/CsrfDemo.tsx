"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { DEFENSES, run, type Defense } from "@/lib/csrf";

const ACCENT = "var(--sec)";
const WHERE = { browser: "Your browser", evil: "evil.example", bank: "bank.example" };

export default function CsrfDemo() {
  const [d, setD] = useState<Defense>("none");
  const steps = run(d);
  const playback = usePlayback(steps.length, 1300);
  const s = steps[playback.i];
  const last = steps.at(-1)!;
  return (
    <SessionPage>
      <SessionHeader kicker="Security · interactive" title="Cross-site request forgery (CSRF)" blurb="Browsers attach your cookies to every request sent to a site, no matter which page sent it. So another site can make your browser act on your behalf, using your logged-in session." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The forged request">
              <ol className="space-y-2">
                {steps.slice(0, playback.i + 1).map((x, i) => (
                  <li key={i} className="rounded-lg border p-2.5 text-sm" style={{ borderColor: x.bad ? "var(--bad)" : x.good ? "var(--good)" : i === playback.i ? ACCENT : "var(--line)", background: "var(--inset)" }}>
                    <p className="font-mono text-[11px] text-[var(--faint)]">{WHERE[x.at]}</p>
                    <p style={{ color: x.bad ? "var(--bad)" : x.good ? "var(--good)" : undefined }}>{x.text}</p>
                  </li>
                ))}
              </ol>
              <pre className="mt-4 overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] text-[var(--muted)]">{`<!-- on evil.example -->
<form action="https://bank.example/transfer" method="POST">
  <input type="hidden" name="to" value="attacker">
  <input type="hidden" name="amount" value="500">
</form>
<script>document.forms[0].submit()</script>`}</pre>
            </section>
          }
          panel={
            <SystemMapPanel caption={s.text}>
              <Choices label="Bank's defense" accent={ACCENT} value={d} onChange={(v) => { setD(v); playback.reset(); }} options={DEFENSES.map((x) => ({ id: x.id, label: x.label }))} />
              <p className="w-full text-xs text-[var(--muted)]">{DEFENSES.find((x) => x.id === d)!.how}</p>
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next" status={playback.atEnd ? (last.bad ? "$500 stolen" : "attack blocked") : `step ${playback.i + 1} of ${steps.length}`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="You're logged in somewhere" what="The bank set a session cookie. Your browser will send it with every request to bank.example." accent={ACCENT} active={playback.i === 0}><p className="text-sm text-[var(--muted)]">Normal and expected.</p></FlowStep>
              <FlowArrow label="you visit another site" accent={ACCENT} />
              <FlowStep n={2} title="Another site sends a request for you" what="A hidden form or image tag on evil.example targets the bank. The attacker can't read the response, but doesn't need to." accent={ACCENT} active={playback.i === 1}><p className="text-sm text-[var(--muted)]">Only state-changing requests matter: transfers, password changes.</p></FlowStep>
              <FlowArrow label="the cookie goes along" accent={ACCENT} />
              <FlowStep n={3} title="Make cross-site requests different" what="SameSite cookies stay home on cross-site POSTs. CSRF tokens prove the form came from your own page. The Origin header says who sent it." accent={ACCENT} active={d !== "none"}><p className="text-sm text-[var(--muted)]">Use SameSite=Lax as the baseline, plus tokens or Origin checks.</p></FlowStep>
              <FlowArrow label="the result" accent={ACCENT} />
              <FlowStep n={4} title="Never change state on GET" what="SameSite=Lax still sends cookies on top-level GET navigations, so a GET that transfers money is still forgeable." accent={ACCENT} active={playback.atEnd}>
                <ul className="space-y-1 text-sm">{DEFENSES.map((x) => <li key={x.id} className="flex justify-between gap-3"><span>{x.label}</span><span style={{ color: run(x.id).at(-1)!.bad ? "var(--bad)" : "var(--good)" }}>{run(x.id).at(-1)!.bad ? "stolen" : "blocked"}</span></li>)}</ul>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
