"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { ATTACKS, encode, tokenFor, verify, type Attack } from "@/lib/jwt";

const ACCENT = "var(--sec)";

export default function JwtDemo() {
  const [attack, setAttack] = useState<Attack>("tamper");
  const [strict, setStrict] = useState<"strict" | "loose">("strict");
  const t = tokenFor(attack);
  const [h, p, s] = encode(t).split(".");
  const res = verify(t, strict === "strict");
  const a = ATTACKS.find((x) => x.id === attack)!;

  return (
    <SessionPage>
      <SessionHeader kicker="Security · interactive" title="JWTs: what's inside, and what makes them safe" blurb="A JWT is three base64 strings joined by dots. Anyone can decode it and read the claims, so the only thing that makes it trustworthy is the signature check. Try forging one. (The signature here is a simplified stand-in for HMAC.)" />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The token and its decoded parts">
              <p className="break-all font-mono text-xs leading-5"><span style={{ color: "var(--c4)" }}>{h}</span>.<span style={{ color: "var(--c5)" }}>{p}</span>.<span style={{ color: "var(--c3)" }}>{s || "(empty)"}</span></p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-xs" style={{ color: "var(--c4)" }}>{JSON.stringify(t.header, null, 2)}</pre>
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-xs" style={{ color: "var(--c5)" }}>{JSON.stringify(t.payload, null, 2)}</pre>
              </div>
              <ul className="mt-4 space-y-1.5">
                {res.checks.map((c) => (
                  <li key={c.name} className="flex flex-wrap justify-between gap-2 rounded-md bg-[var(--inset)] px-2.5 py-1.5 text-sm">
                    <span>{c.name}</span><span className="font-mono text-xs" style={{ color: c.ok ? "var(--good)" : "var(--bad)" }}>{c.ok ? "✓" : "✗"} {c.detail}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 rounded-lg border p-3 text-sm font-semibold" style={{ borderColor: res.accepted ? (attack === "valid" ? "var(--good)" : "var(--bad)") : "var(--good)", color: res.accepted && attack !== "valid" ? "var(--bad)" : "var(--good)" }}>
                {res.accepted ? (attack === "valid" ? "Accepted: a genuine token." : "Accepted: the forged token got in as admin.") : "Rejected."}
              </p>
            </section>
          }
          panel={
            <SystemMapPanel caption={a.note}>
              <Choices label="Token" accent={ACCENT} value={attack} onChange={setAttack} options={ATTACKS.map((x) => ({ id: x.id, label: x.label }))} />
              <Choices label="Server verification" accent={ACCENT} value={strict} onChange={setStrict} options={[{ id: "strict", label: "Allow-list HS256" }, { id: "loose", label: "Trust the alg header" }]} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Decode: anyone can read it" what="The header and payload are only base64url, not encrypted. Never put secrets in a JWT." accent={ACCENT}><p className="font-mono text-sm">role: {String(t.payload.role)}</p></FlowStep>
              <FlowArrow label="check the signature" accent={ACCENT} />
              <FlowStep n={2} title="The signature covers header + payload" what="The server signs the first two parts with its secret. Change one character and the signature no longer matches." accent={ACCENT} active={attack === "tamper"}><p className="text-sm text-[var(--muted)]">Editing role without the secret breaks the signature.</p></FlowStep>
              <FlowArrow label="don't let the token choose" accent={ACCENT} />
              <FlowStep n={3} title="Pin the algorithm on the server" what="Some old libraries honoured alg: none and skipped the check. Always pass an explicit allow-list of algorithms to verify()." accent={ACCENT} active={attack === "none"}><p className="text-sm text-[var(--muted)]">{strict === "loose" && attack === "none" ? "Trusting the header lets the attacker turn verification off." : "Allow-list: only HS256 is accepted."}</p></FlowStep>
              <FlowArrow label="and check the claims" accent={ACCENT} />
              <FlowStep n={4} title="Check expiry, audience and issuer" what="A valid signature only proves who issued it. Short expiry limits how long a stolen token works, since JWTs can't easily be revoked." accent={ACCENT} active={attack === "expired"}><p className="text-sm text-[var(--muted)]">exp, aud, iss: verify them all.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
