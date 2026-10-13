"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState, type ReactNode } from "react";
import { Choices } from "@/components/session/ui";
import { CASES, KEY, scenario, type Case } from "@/lib/signatures";

const ACCENT = "var(--sec)";

export default function SignatureDemo() {
  const [c, setC] = useState<Case>("genuine");
  const s = scenario(c);
  const caption = c === "genuine" ? "Alice's public key turns the signature back into the hash of the message. They match: Alice sent it, and it wasn't changed."
    : c === "tampered" ? `The message changed, so its hash is now ${s.h}. The signature still decodes to ${s.recovered}, the old hash. Rejected.`
    : "Mallory signed with her own private key. Alice's public key doesn't undo it, so the result is garbage. Rejected.";
  return (
    <SessionPage>
      <SessionHeader kicker="Security · interactive" title="Digital signatures" blurb="Alice signs a hash of her message with her private key. Anyone with her public key can check it. This uses real RSA maths with tiny numbers so you can follow it; real keys are thousands of bits." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Sign and verify">
              <div className="grid gap-3 sm:grid-cols-2">
                <Box title={`Signing (${s.signerName})`}>
                  <p>“{s.signedMsg}”</p>
                  <p className="mt-1 font-mono text-xs text-[var(--muted)]">signature = hash^d mod n</p>
                  <p className="font-mono text-xs">= <span style={{ color: ACCENT }}>{s.sig}</span></p>
                </Box>
                <Box title="Received by Bob">
                  <p style={{ color: s.received !== s.signedMsg ? "var(--bad)" : undefined }}>“{s.received}”</p>
                  <p className="mt-1 font-mono text-xs">signature {s.sig}</p>
                </Box>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Box title="Bob hashes the message"><p className="font-mono">{s.h}</p></Box>
                <Box title={`signature^e mod n (Alice's public key)`}><p className="font-mono">{s.sig}^{KEY.e} mod {KEY.n} = {s.recovered}</p></Box>
              </div>
              <p className="mt-4 rounded-lg p-2 text-center font-mono text-sm" style={{ background: s.valid ? "var(--good)" : "var(--bad)", color: "var(--on-accent)" }}>{s.h} {s.valid ? "=" : "≠"} {s.recovered}: {s.valid ? "valid signature" : "invalid signature"}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">Alice&apos;s public key: n = {KEY.n}, e = {KEY.e}. Her private d = {KEY.d} never leaves her.</p>
            </section>
          }
          panel={<SystemMapPanel caption={caption}><Choices label="Scenario" accent={ACCENT} value={c} onChange={setC} options={CASES} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Hash the message" what="A fixed-size fingerprint. Change one character and the hash changes completely." accent={ACCENT} active={c === "tampered"}><p className="font-mono text-xs">SHA-256(message)</p></FlowStep>
              <FlowArrow label="private key" accent={ACCENT} />
              <FlowStep n={2} title="Sign with the private key" what="Only the holder of the private key can produce a value that the public key maps back to the hash." accent={ACCENT} active={c === "forged"}><p className="text-sm text-[var(--muted)]">Signing isn&apos;t encrypting: the message stays readable.</p></FlowStep>
              <FlowArrow label="public key" accent={ACCENT} />
              <FlowStep n={3} title="Verify with the public key" what="Anyone can check: recompute the hash, apply the public key to the signature, compare." accent={ACCENT} active={c === "genuine"}><p className="text-sm text-[var(--muted)]">Proves who signed and that nothing changed.</p></FlowStep>
              <FlowArrow label="but whose key?" accent={ACCENT} />
              <FlowStep n={4} title="Trust the key itself" what="A signature only proves which key signed. Certificates (TLS), key servers or pinned keys tie the key to a real identity." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Modern choices: Ed25519, ECDSA, RSA-PSS.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-lg border border-[var(--line)] bg-[var(--inset)] p-2.5"><p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">{title}</p><div className="mt-1 text-sm">{children}</div></div>;
}
