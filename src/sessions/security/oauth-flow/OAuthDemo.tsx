"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SCENARIOS, steps, type Lane, type Scenario } from "@/lib/oauthFlow";

const ACCENT = "var(--sec)";
const LANES: { id: Lane; label: string }[] = [{ id: "user", label: "User's browser" }, { id: "app", label: "Your app" }, { id: "auth", label: "Auth server" }, { id: "api", label: "API" }, { id: "attacker", label: "Attacker" }];

export default function OAuthDemo() {
  const [s, setS] = useState<Scenario>("normal");
  return (
    <SessionPage>
      <SessionHeader kicker="Security · interactive" title="OAuth: the authorization code flow" blurb="“Sign in with Google” or “Allow this app to read your calendar”: OAuth lets an app act for a user without ever seeing their password. The user approves at the provider, the app gets a short-lived code, and swaps it for tokens. PKCE stops a stolen code being useful." />
      <div className="mt-6"><Run key={s} s={s} setS={setS} /></div>
    </SessionPage>
  );
}

function Run({ s, setS }: { s: Scenario; setS: (v: Scenario) => void }) {
  const st = steps(s);
  const playback = usePlayback(st.length, 1700);
  const shown = st.slice(0, playback.i + 1);
  const cur = st[playback.i];
  const lanes = LANES.filter((l) => s !== "normal" ? l.id !== "api" : l.id !== "attacker");
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Message sequence">
          <div className="grid gap-1 text-center text-[11px]" style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))` }}>
            {lanes.map((l) => <span key={l.id} className="rounded px-1 py-1" style={{ background: l.id === "attacker" ? "var(--bad)" : "var(--inset)", color: l.id === "attacker" ? "var(--on-accent)" : undefined, outline: cur.from === l.id || cur.to === l.id ? `1px solid ${ACCENT}` : undefined }}>{l.label}</span>)}
          </div>
          <ol className="mt-3 space-y-1.5">
            {shown.map((m, i) => (
              <li key={i} className="rounded-md border-l-2 bg-[var(--inset)] px-2 py-1.5" style={{ borderColor: m.bad ? "var(--bad)" : m.blocked ? "var(--good)" : ACCENT, opacity: i === playback.i ? 1 : 0.7 }}>
                <p className="text-[11px] text-[var(--muted)]">{LANES.find((l) => l.id === m.from)!.label} → {LANES.find((l) => l.id === m.to)!.label}</p>
                <p className="break-all font-mono text-xs" style={{ color: m.bad ? "var(--bad)" : m.blocked ? "var(--good)" : undefined }}>{m.msg}</p>
              </li>
            ))}
          </ol>
        </section>
      }
      panel={
        <SystemMapPanel caption={cur.text}>
          <Choices label="Scenario" accent={ACCENT} value={s} onChange={setS} options={SCENARIOS} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next message" status={`step ${playback.i + 1} of ${st.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Redirect to the provider" what="The app asks for specific scopes and sends a random state to stop forged callbacks." accent={ACCENT} active={playback.i <= 1}><p className="text-sm text-[var(--muted)]">The password is only typed at the provider.</p></FlowStep>
          <FlowArrow label="user approves" accent={ACCENT} />
          <FlowStep n={2} title="A code comes back in the URL" what="Short-lived and single-use. URLs leak (history, logs, other apps), so the code alone shouldn't be enough." accent={ACCENT} active={playback.i === 3}><p className="text-sm text-[var(--muted)]">Check state before anything else.</p></FlowStep>
          <FlowArrow label="exchange it" accent={ACCENT} />
          <FlowStep n={3} title="Swap the code for tokens, with proof" what="PKCE: the app sent a hash of a secret at the start and reveals the secret now. Only the app that began the flow can finish it." accent={ACCENT} active={s !== "normal" && playback.i >= 4}><p className="font-mono text-xs">code_challenge = BASE64URL(SHA256(verifier))</p></FlowStep>
          <FlowArrow label="use them" accent={ACCENT} />
          <FlowStep n={4} title="Short access, long refresh" what="Access tokens expire in minutes; refresh tokens get new ones and can be revoked. OIDC adds an ID token saying who the user is." accent={ACCENT} active={s === "normal" && playback.atEnd}><p className="text-sm text-[var(--muted)]">Use PKCE for every client, not just mobile.</p></FlowStep>
        </>
      }
    />
  );
}
