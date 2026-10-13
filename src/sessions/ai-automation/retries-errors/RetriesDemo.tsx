"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { FAILURES, POLICIES, simulate, type Failure, type Policy } from "@/lib/retries";

const ACCENT = "var(--auto)";
const SPAN = 12;

// Keep pills at least 11% apart so attempts made at nearly the same moment stay readable.
function spread(xs: number[]): number[] {
  return xs.reduce<number[]>((out, x) => [...out, out.length ? Math.max(x, out[out.length - 1] + 11) : x], []);
}

export default function RetriesDemo() {
  const [failure, setFailure] = useState<Failure>("transient");
  const [policy, setPolicy] = useState<Policy>("backoff");
  const r = simulate(failure, policy);
  const caption =
    failure === "bad-request" ? (policy === "immediate" ? "Retrying a bad request just sends the same bad request again. Five wasted calls, same 400." : "A 400 won't fix itself. Don't retry: log it and alert a person.")
    : policy === "none" ? "The first hiccup fails the whole workflow, even though a retry seconds later would have worked."
    : policy === "immediate" ? `Six calls in ${r.attempts[r.attempts.length - 1].t} s while the service is still down. Many clients doing this keep it down.`
    : failure === "rate-limit" ? "It waited for the Retry-After time, then succeeded with one extra call."
    : `Waits grow (about 1 s, then 2 s…) with random jitter so clients don't retry in sync. Succeeded at ${r.attempts[r.attempts.length - 1].t} s.`;
  return (
    <SessionPage>
      <SessionHeader kicker="AI Automation · interactive" title="Retries and error handling" blurb="An automated workflow calls an API and gets an error. Some errors go away if you wait, some need you to slow down, and some will never succeed. The retry policy should depend on which." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Attempts over time">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Attempts, 0 to {SPAN} s</p>
              <div className="relative mt-3 h-14 rounded bg-[var(--inset)]">
                {spread(r.attempts.map((a) => 5 + (Math.min(a.t, SPAN) / SPAN) * 90)).map((x, i) => (
                  <span key={i} className="absolute top-1/2 grid h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full px-1 font-mono text-[10px]" style={{ left: `${x}%`, background: r.attempts[i].ok ? "var(--good)" : "var(--bad)", color: "var(--on-accent)" }}>{r.attempts[i].code}</span>
                ))}
              </div>
              <ul className="mt-3 space-y-1 font-mono text-xs">
                {r.attempts.map((a, i) => <li key={i} className="flex justify-between"><span>attempt {i + 1} at {a.t} s</span><span style={{ color: a.ok ? "var(--good)" : "var(--bad)" }}>{a.code}</span></li>)}
              </ul>
              <p className="mt-3 font-mono text-sm" style={{ color: r.ok ? "var(--good)" : "var(--bad)" }}>Outcome: {r.outcome}</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="The API returns" accent={ACCENT} value={failure} onChange={setFailure} options={FAILURES} />
              <Choices label="Retry policy" accent={ACCENT} value={policy} onChange={setPolicy} options={POLICIES} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Sort the error first" what="Timeouts, 502/503/504 and dropped connections are usually temporary. 400, 401, 403 and 404 aren't." accent={ACCENT} active={failure === "bad-request"}><p className="text-sm text-[var(--muted)]">Only retry what can succeed later.</p></FlowStep>
              <FlowArrow label="temporary" accent={ACCENT} />
              <FlowStep n={2} title="Back off exponentially, with jitter" what="Wait 1 s, 2 s, 4 s… plus some randomness, and stop after a few tries." accent={ACCENT} active={policy === "backoff" && failure === "transient"}><p className="font-mono text-xs">delay = base × 2^attempt × random(0.5, 1.5)</p></FlowStep>
              <FlowArrow label="rate limited" accent={ACCENT} />
              <FlowStep n={3} title="Respect Retry-After" what="A 429 tells you how long to wait. Waiting less just earns more 429s." accent={ACCENT} active={failure === "rate-limit"}><p className="font-mono text-xs">Retry-After: 10</p></FlowStep>
              <FlowArrow label="still failing" accent={ACCENT} />
              <FlowStep n={4} title="Fail loudly, safely" what="After the last try, park the item in a dead-letter queue and alert a person. Make steps idempotent so a retry never charges twice." accent={ACCENT} active={!r.ok}><p className="text-sm text-[var(--muted)]">Retries + idempotency go together.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
