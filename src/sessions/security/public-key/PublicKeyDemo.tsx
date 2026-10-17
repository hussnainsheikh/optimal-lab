"use client";

import { useState, type ReactNode } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { PAIRS, decryptNum, encryptText, makeKeys, modpow, show, trialDivision, type PrimePair } from "@/lib/publicKey";

const ACCENT = "var(--sec)";
type Reader = "bob" | "eve";

export default function PublicKeyDemo() {
  const [pair, setPair] = useState<PrimePair>("61-53");
  const [text, setText] = useState("HELLO BOB");
  const [reader, setReader] = useState<Reader>("bob");
  const walk = useWalk(6, 800);
  const at = walk.stage;

  const k = makeKeys(pair);
  const enc = encryptText(text, k);
  const bob = enc.map((x) => decryptNum(x.c, k));
  const eve = enc.map((x) => modpow(x.c, k.e, k.n));
  const out = reader === "bob" ? bob : eve;
  const readable = reader === "bob";
  const factor = trialDivision(k.n);
  const repeats = enc.length - new Set(enc.map((x) => x.c)).size;

  const caption = readable
    ? `Alice locked “${text}” with Bob's public key (n = ${k.n}, e = ${k.e}). Only d = ${k.d} turns it back.`
    : `Eve has the public key and the ciphertext. Applying e again gives “${show(eve)}”: the public key can't unlock what it locked.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Security · interactive"
        title="Public-key cryptography"
        blurb="Bob publishes a public key. Anyone can use it to encrypt a message to him, but only his private key can decrypt it. No shared secret has to be agreed first. This is RSA with tiny numbers so you can check every step; real keys are 2048 bits or more."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Keys, ciphertext and what each side reads">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <Box title="Bob's public key (anyone)">
                  <p className="font-mono">n = {k.n}, e = {k.e}</p>
                </Box>
                <Box title="Bob's private key (only Bob)">
                  <p className="font-mono">d = {k.d}</p>
                </Box>
              </div>
              <Box title="On the wire: one number per character" className="mt-3">
                <p className="break-all font-mono text-xs">{enc.map((x) => x.c).join(" ") || "(empty)"}</p>
              </Box>
              <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                <Box title="Bob decrypts with d">
                  <p className="break-all font-mono" style={{ color: "var(--good)" }}>{show(bob) || "—"}</p>
                </Box>
                <Box title="Eve tries the public key">
                  <p className="break-all font-mono" style={{ color: "var(--bad)" }}>{show(eve) || "—"}</p>
                </Box>
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <label className="block w-full min-w-0">
                <span className="text-sm font-medium">Alice&apos;s message</span>
                <input value={text} maxLength={24} onChange={(e) => setText(e.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-[var(--line-strong)] bg-[var(--inset)] px-3 font-mono text-sm" />
              </label>
              <RunButton busy={walk.busy} onClick={walk.run} accent={ACCENT} running="Working…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Pick two secret primes" what="Bob chooses two primes and keeps them to himself. Everything else is built from them." accent={ACCENT} active={at === 0}>
                <Choices accent={ACCENT} value={pair} onChange={setPair} options={PAIRS.map((p) => ({ id: p.id, label: p.label }))} />
              </FlowStep>
              <FlowArrow label="p and q" accent={ACCENT} active={at === 1} />
              <FlowStep n={2} title="Publish n and e" what="n is p × q. e is a small number that shares no factor with (p − 1)(q − 1). Together they are the public key." accent={ACCENT} active={at === 1}>
                <p className="font-mono text-sm">n = {k.p} × {k.q} = {k.n}</p>
                <p className="font-mono text-sm">e = {k.e}</p>
              </FlowStep>
              <FlowArrow label="public key" accent={ACCENT} active={at === 2} />
              <FlowStep n={3} title="Work out the private key d" what="d undoes e. Computing it needs (p − 1)(q − 1), which needs p and q, which only Bob knows." accent={ACCENT} active={at === 2}>
                <p className="font-mono text-sm">(p − 1)(q − 1) = {k.phi}</p>
                <p className="font-mono text-sm">d = {k.d}, because {k.e} × {k.d} mod {k.phi} = {(k.e * k.d) % k.phi}</p>
              </FlowStep>
              <FlowArrow label="Alice fetches n, e" accent={ACCENT} active={at === 3} />
              <FlowStep n={4} title="Encrypt with the public key" what="Alice turns each character into a number m and sends c = m^e mod n." accent={ACCENT} active={at === 3}>
                <div className="max-h-48 overflow-auto rounded-md bg-[var(--inset)] p-2">
                  <table className="w-full font-mono text-xs">
                    <thead className="text-[var(--faint)]">
                      <tr><th className="text-left font-normal">char</th><th className="text-left font-normal">m</th><th className="text-left font-normal">m^{k.e} mod {k.n}</th></tr>
                    </thead>
                    <tbody>
                      {enc.map((x, i) => (
                        <tr key={i}><td>{x.ch === " " ? "␣" : x.ch}</td><td>{x.m}</td><td style={{ color: ACCENT }}>{x.c}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FlowStep>
              <FlowArrow label={`${enc.length} numbers`} accent={ACCENT} active={at === 4} />
              <FlowStep n={5} title="Decrypt with the private key" what="Bob computes c^d mod n and gets m back. Using e again does not undo e." accent={ACCENT} active={at === 4}>
                <Choices accent={ACCENT} value={reader} onChange={setReader} options={[{ id: "bob", label: `Bob: c^${k.d} mod ${k.n}` }, { id: "eve", label: `Eve: c^${k.e} mod ${k.n}` }]} />
                <p className="mt-2 break-all font-mono text-sm" style={{ color: readable ? "var(--good)" : "var(--bad)" }}>
                  {out.slice(0, 6).join(" ")}{out.length > 6 ? " …" : ""} → “{show(out)}”
                </p>
              </FlowStep>
              <FlowArrow label="what real systems add" accent={ACCENT} active={at === 5} />
              <FlowStep n={6} title="Know the limits" what="Tiny primes make n easy to split, and plain RSA is deterministic. Real systems use huge keys, random padding, and encrypt a short symmetric key rather than the message." accent={ACCENT} active={at === 5}>
                <ul className="space-y-1 text-sm text-[var(--muted)]">
                  <li>Splitting n = {k.n} by trying odd numbers takes {factor.tries} tries (finds {factor.p}). A 2048-bit n has 617 digits; no known method splits it in practice.</li>
                  <li>{repeats > 0 ? `${repeats} repeated number${repeats === 1 ? "" : "s"} on the wire: the same letter always encrypts the same way.` : "Type a repeated letter: it always encrypts to the same number."} OAEP padding adds randomness to fix this.</li>
                  <li>TLS and age, for example, use public keys to agree on or wrap an AES key, then AES encrypts the data.</li>
                </ul>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Box({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 rounded-lg border border-[var(--line)] bg-[var(--inset)] p-2.5 ${className}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">{title}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
