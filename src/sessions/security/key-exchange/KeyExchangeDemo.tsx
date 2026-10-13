"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Slider } from "@/components/session/ui";
import { exchange, G, P } from "@/lib/keyExchange";

const ACCENT = "var(--sec)";

export default function KeyExchangeDemo() {
  const [a, setA] = useState(6);
  const [b, setB] = useState(15);
  const r = exchange(a, b);
  const col = "rounded-lg border border-[var(--line)] bg-[var(--inset)] p-2.5 text-sm";
  return (
    <SessionPage>
      <SessionHeader kicker="Security · interactive" title="Key exchange: Diffie-Hellman" blurb="Alice and Bob want a shared secret key, but everything they send can be read by Eve. Each picks a private number, sends a public one, and both end up with the same secret that never crossed the wire. Tiny numbers here so you can check the maths." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The exchange">
              <p className="font-mono text-xs text-[var(--muted)]">public: p = {P}, g = {G}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className={col}><p className="font-medium">Alice</p><p className="font-mono text-xs">secret a = <b style={{ color: ACCENT }}>{a}</b></p><p className="font-mono text-xs">A = {G}^{a} mod {P} = {r.A}</p><p className="mt-1 font-mono text-xs">B^a mod p = <b>{r.sA}</b></p></div>
                <div className={col} style={{ borderColor: "var(--bad)" }}><p className="font-medium">Eve sees</p><p className="font-mono text-xs">p = {P}, g = {G}</p><p className="font-mono text-xs">A = {r.A}, B = {r.B}</p><p className="mt-1 text-xs text-[var(--muted)]">not a, b, or the secret</p></div>
                <div className={col}><p className="font-medium">Bob</p><p className="font-mono text-xs">secret b = <b style={{ color: ACCENT }}>{b}</b></p><p className="font-mono text-xs">B = {G}^{b} mod {P} = {r.B}</p><p className="mt-1 font-mono text-xs">A^b mod p = <b>{r.sB}</b></p></div>
              </div>
              <p className="mt-4 rounded-lg p-2 text-center font-mono text-sm" style={{ background: r.sA === r.sB ? "var(--good)" : "var(--bad)", color: "var(--on-accent)" }}>shared secret: {r.sA} = {r.sB}</p>
              <p className="mt-3 text-xs text-[var(--muted)]">Eve could try every a until {G}^a mod {P} = {r.A}: she finds a = {r.found} in {r.tries} tries. With a 2048-bit p that search takes longer than the age of the universe.</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={`Both compute g^(ab) mod p = ${r.sA}: Alice as (g^b)^a, Bob as (g^a)^b. Eve only has g^a and g^b, and multiplying those gives g^(a+b), not g^(ab).`}>
              <Slider label="Alice's secret a" accent={ACCENT} value={a} min={2} max={20} step={1} format={String} onChange={setA} />
              <Slider label="Bob's secret b" accent={ACCENT} value={b} min={2} max={20} step={1} format={String} onChange={setB} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Agree on public numbers" what="A prime p and a generator g. Everyone, including attackers, knows them." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Modern TLS uses elliptic curves (X25519) instead.</p></FlowStep>
              <FlowArrow label="pick secrets" accent={ACCENT} />
              <FlowStep n={2} title="Send g to the power of your secret" what="Undoing modular exponentiation (the discrete logarithm) is infeasible for big numbers." accent={ACCENT}><p className="font-mono text-xs">A = g^a mod p</p></FlowStep>
              <FlowArrow label="combine" accent={ACCENT} />
              <FlowStep n={3} title="Both reach the same secret" what="Each raises the other's public value to their own secret. The results match; derive the session key from it." accent={ACCENT} active><p className="font-mono text-xs">(g^b)^a = (g^a)^b</p></FlowStep>
              <FlowArrow label="the catch" accent={ACCENT} />
              <FlowStep n={4} title="It doesn't prove who you're talking to" what="A man in the middle can run one exchange with each side. TLS signs the exchange with the server's certificate to stop that." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Fresh keys per session give forward secrecy.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
