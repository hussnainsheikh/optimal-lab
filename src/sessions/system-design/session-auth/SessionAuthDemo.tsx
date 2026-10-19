"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { ACCESS_TTLS, DESIGNS, JWT_TTL_MIN, LEAK_AT, LOOKUP_MS, REQ_PER_MIN, REVOKE_AT, START, VERIFY_MS, duration, run, type Design, type Leak, type Settings, type Storage } from "@/lib/sessionAuth";

const ACCENT = "var(--sys)";
const STORAGES: { id: Storage; label: string }[] = [
  { id: "cookie", label: "HttpOnly cookie" },
  { id: "localStorage", label: "localStorage" },
];
const LEAKS: { id: Leak; label: string }[] = [
  { id: "xss", label: "An XSS bug runs a script" },
  { id: "log", label: "A log prints the headers" },
];
const SPAN = 120; // minutes drawn on the timeline

export default function SessionAuthDemo() {
  const [s, setS] = useState<Settings>(START);
  const set = (patch: Partial<Settings>) => setS((cur) => ({ ...cur, ...patch }));
  const r = run(s);
  const all = (d: Design) => run({ ...s, design: d });

  const caption = !r.leaked
    ? `Nothing leaked: ${r.notes[0] ?? ""}`
    : `Leaked at minute ${LEAK_AT}: ${r.stolen}. Sara signs out everywhere at minute ${REVOKE_AT}; the attacker keeps access ${r.windowAfterRevoke ? `for ${duration(r.windowAfterRevoke)} more` : "for no longer"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Sessions, tokens and refresh flows"
        blurb={`Sara signs in at minute 0. At minute ${LEAK_AT} her credential leaks. At minute ${REVOKE_AT} she presses “sign out of every device”. Keep her signed in with a server session, a long-lived JWT, or a short access token with a rotating refresh token, stored in a cookie or in localStorage, and see how long the attacker keeps access and what each request costs.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Who has access, minute by minute, under each design">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">first {SPAN} minutes</p>
              <div className="mt-3 space-y-3">
                {DESIGNS.map((d) => {
                  const x = all(d.id);
                  const end = x.attackerUntil === null ? null : Math.min(x.attackerUntil, SPAN);
                  return (
                    <div key={d.id}>
                      <p className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                        <span style={{ fontWeight: d.id === s.design ? 700 : 400 }}>{d.label}</span>
                        <span className="font-mono" style={{ color: x.windowAfterRevoke ? "var(--bad)" : "var(--good)" }}>
                          {x.leaked ? (x.windowAfterRevoke ? `+${duration(x.windowAfterRevoke)} after sign-out` : "cut off at sign-out or before") : "no leak"}
                        </span>
                      </p>
                      <div className="relative mt-1 h-4 rounded bg-[var(--track)]">
                        <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${(REVOKE_AT / SPAN) * 100}%`, background: "color-mix(in srgb, var(--good) 45%, transparent)" }} title="Sara signed in" />
                        {end !== null && <span className="absolute inset-y-0 rounded" style={{ left: `${(LEAK_AT / SPAN) * 100}%`, width: `${((end - LEAK_AT) / SPAN) * 100}%`, background: "var(--bad)", opacity: 0.75 }} title="attacker has access" />}
                        {x.attackerUntil !== null && x.attackerUntil > SPAN && <span className="absolute -right-1 top-1/2 -translate-y-1/2 font-mono text-[10px]" style={{ color: "var(--bad)" }}>→</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="relative mt-1 h-4 font-mono text-[10px] text-[var(--faint)]">
                <span className="absolute left-0">0</span>
                <span className="absolute -translate-x-1/2" style={{ left: `${(LEAK_AT / SPAN) * 100}%`, color: "var(--bad)" }}>
                  leak
                </span>
                <span className="absolute -translate-x-1/2" style={{ left: `${(REVOKE_AT / SPAN) * 100}%`, color: "var(--good)" }}>
                  &nbsp;&nbsp;sign-out
                </span>
                <span className="absolute right-0">{SPAN} min</span>
              </div>
              <p className="mt-2 text-[11px] text-[var(--muted)]">Green: Sara signed in. Red: the attacker has access. An arrow: it continues past the chart ({duration(JWT_TTL_MIN)} for the JWT).</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Design" accent={ACCENT} value={s.design} onChange={(v) => set({ design: v })} options={DESIGNS.map((d) => ({ id: d.id, label: d.label }))} />
              </div>
              <div className="w-full">
                <Choices label="The browser keeps it in" accent={ACCENT} value={s.storage} onChange={(v) => set({ storage: v })} options={STORAGES} />
              </div>
              <div className="w-full">
                <Choices label="How it leaks" accent={ACCENT} value={s.leak} onChange={(v) => set({ leak: v })} options={LEAKS} />
              </div>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Server session: look it up every time" what={`The cookie holds a random id; Redis holds who it belongs to. Every request costs a lookup (about ${LOOKUP_MS} ms), and signing out is deleting the row: the stolen id stops working on the next request.`} accent={ACCENT} active={s.design === "session"}>
                <Line r={all("session")} />
              </FlowStep>
              <FlowArrow label="skip the lookup" accent={ACCENT} />

              <FlowStep n={2} title="Long-lived JWT: nothing to look up, nothing to revoke" what={`The token carries the user id and an expiry, signed by the server, so any instance can check it in about ${VERIFY_MS} ms with no shared store. The same property means nothing can cancel it: a stolen 24-hour token works for 24 hours, unless every request checks a blocklist, which is a lookup again.`} accent={ACCENT} active={s.design === "jwt"}>
                <Line r={all("jwt")} />
              </FlowStep>
              <FlowArrow label="make it short" accent={ACCENT} />

              <FlowStep n={3} title="Short access token, rotating refresh token" what="Keep the access token valid for minutes, so a stolen one dies soon. A refresh token, stored and revocable on the server, gets a new access token when it expires, and is replaced each time it's used. If an old refresh token turns up again, two parties have it: revoke the whole family." accent={ACCENT} active={s.design === "refresh"}>
                <Choices label="Access token lifetime" accent={ACCENT} value={String(s.accessTtl)} onChange={(v) => set({ accessTtl: Number(v) })} options={ACCESS_TTLS.map((t) => ({ id: String(t), label: `${t} min` }))} />
                <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={s.reuseDetection} onChange={(e) => set({ reuseDetection: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Refresh token reuse detection
                </label>
                <Line r={all("refresh")} />
                {s.design === "refresh" && r.leaked && <p className="mt-1 text-xs text-[var(--muted)]">{r.revokeWorks}</p>}
              </FlowStep>
              <FlowArrow label="where the browser keeps it" accent={ACCENT} />

              <FlowStep n={4} title="Keep it out of reach of scripts" what="Any script on the page can read localStorage, including one injected through an XSS bug, and send the token anywhere. An HttpOnly, Secure, SameSite cookie is sent by the browser but can't be read by JavaScript. Cookies bring back CSRF, which SameSite and a CSRF token handle." accent={ACCENT} active={false}>
                <Choices label="The browser keeps it in" accent={ACCENT} value={s.storage} onChange={(v) => set({ storage: v })} options={STORAGES} />
                <ul className="mt-2 space-y-1 text-xs">
                  {r.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                  <li className="text-[var(--muted)]">{r.csrfNeeded ? "Cookie: set SameSite=Lax or Strict and add a CSRF token to state-changing forms." : "localStorage: no CSRF, because the app attaches the token itself, and no protection from XSS."}</li>
                </ul>
                <p className="mt-2 text-[11px] text-[var(--faint)]">
                  {REQ_PER_MIN.toLocaleString("en-US")} requests a minute across all users. Refresh calls assume one per 50 requests. Timings are typical, not measured here.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Line({ r }: { r: ReturnType<typeof run> }) {
  return (
    <p className="font-mono text-xs">
      <span style={{ color: r.windowAfterRevoke ? "var(--bad)" : "var(--good)" }}>{r.leaked ? (r.windowAfterRevoke ? `attacker +${duration(r.windowAfterRevoke)} after sign-out` : `attacker cut off by minute ${r.attackerUntil}`) : "nothing leaked"}</span> · {r.lookupsPerMin.toLocaleString("en-US")} store lookups a minute · {r.msPerRequest} ms a request
    </p>
  );
}
