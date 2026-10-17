"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { CREDENTIAL, MODES, RP_ID, SITES, ceremony, challenge, type Mode, type Site } from "@/lib/passkeys";

const ACCENT = "var(--sec)";

export default function PasskeysDemo() {
  const [mode, setMode] = useState<Mode>("signin");
  const [site, setSite] = useState<Site>("real");
  const [uv, setUv] = useState(true);
  const [k, setK] = useState(0);
  const walk = useWalk(5, 1000);
  const stage = walk.stage;
  const r = ceremony(mode, site, uv, k);
  const ch = challenge(k);
  const register = mode === "register";
  const produced = r.unlocked && r.hasKey;
  const siteName = site === "real" ? RP_ID : r.rpId;

  const packets: Packet[] =
    stage === 0 ? hops(`ch-${k}`, ["site", "browser"], { label: "challenge" })
    : stage === 1 ? hops(`cd-${k}`, ["browser", "auth"], { label: `rpId ${r.rpId}` })
    : stage === 3 && produced ? hops(`sig-${k}`, ["auth", "browser"], { label: register ? "public key" : "signature" })
    : stage === 4 && produced ? hops(`res-${k}`, ["browser", "site"], { label: register ? "public key" : "assertion", tone: r.ok ? "good" : "bad" })
    : [];

  const caption =
    stage === 0 ? `${siteName} sends a fresh random challenge, ${ch}${register ? ", plus the user's name and its own domain" : ""}.`
    : stage === 1 ? `The browser writes the page's real origin, ${r.origin}, next to the challenge and asks the authenticator for a key for ${r.rpId}.`
    : stage === 2 ? (uv ? "Ada touches the fingerprint sensor. The key stays locked until she does." : "The fingerprint doesn't match. The authenticator refuses.")
    : stage === 3 ? (!uv ? "Nothing to send." : !r.hasKey ? `No passkey for ${r.rpId} on this device.` : register ? "The authenticator makes a new key pair for this site and returns only the public half." : `Signed: ${r.hash}^d mod ${CREDENTIAL.n} = ${r.signature}.`)
    : stage === 4 ? r.summary
    : r.summary;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Security · interactive"
        title="Passkeys and WebAuthn"
        blurb="A passkey is a key pair your phone or laptop makes for one website. The site stores only the public key. To sign in, your device signs a fresh challenge after a fingerprint or PIN. There is no password to type, reuse, leak or phish. Signatures here use toy RSA so you can check them; real passkeys use P-256 keys."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="min-w-0 space-y-3">
              <SystemMap
                chrome="split"
                title="Ada's authenticator, her browser and the website"
                accent={ACCENT}
                nodes={[
                  { id: "auth", label: "Authenticator", sub: stage === 2 ? (uv ? "unlocked" : "locked") : `keys for ${RP_ID}`, at: [13, 50], mobileAt: [50, 13], state: stage === 2 ? (uv ? "active" : "bad") : stage === 3 ? "active" : "idle" },
                  { id: "browser", label: "Browser", sub: r.origin.replace("https://", ""), at: [50, 50], state: stage === 1 ? "active" : "idle" },
                  { id: "site", label: siteName, sub: site === "real" ? "the real bank" : "look-alike", at: [87, 50], mobileAt: [50, 87], state: stage === null || stage === 4 ? (r.ok ? "good" : site === "real" ? "bad" : "dim") : stage === 0 ? "active" : "idle" },
                ]}
                links={[
                  { from: "auth", to: "browser", label: "USB, NFC or built in" },
                  { from: "browser", to: "site", label: "HTTPS" },
                ]}
                packets={packets}
                aspect={2.6}
                mobileAspect={0.9}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 sm:p-4" aria-label="What the server stores and checks">
                <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 rounded-lg bg-[var(--inset)] p-2.5">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Server stores</p>
                    <p className="mt-1 break-all font-mono text-xs">{`${CREDENTIAL.id} → n = ${CREDENTIAL.n}, e = ${CREDENTIAL.e}`}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">A public key. A database leak gives away nothing that signs in.</p>
                  </div>
                  <div className="min-w-0 rounded-lg bg-[var(--inset)] p-2.5">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Device keeps</p>
                    <p className="mt-1 break-all font-mono text-xs">{`rpId ${CREDENTIAL.rpId}, d = ${CREDENTIAL.d}`}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">Never leaves the authenticator (synced passkeys travel end-to-end encrypted).</p>
                  </div>
                </div>
                {r.checks.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {r.checks.map((c) => (
                      <li key={c.label} className="flex min-w-0 gap-2 text-sm">
                        <span className="w-4 shrink-0 font-mono" style={{ color: c.pass ? "var(--good)" : "var(--bad)" }}>{c.pass ? "✓" : "✗"}</span>
                        <span className="min-w-0 break-words">{c.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-sm" style={{ color: r.ok ? "var(--good)" : "var(--bad)" }}>{r.summary}</p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Ceremony" accent={ACCENT} value={mode} onChange={setMode} options={MODES} />
              <Choices label="Where Ada is" accent={ACCENT} value={site} onChange={setSite} options={SITES} />
              <RunButton busy={walk.busy} onClick={walk.run} accent={ACCENT} running="Running…">
                {register ? "Create the passkey" : "Sign in"}
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Send a fresh challenge" what="The site sends random bytes it has never used before, so an old answer can't be replayed." accent={ACCENT} active={stage === 0}>
                <p className="font-mono text-sm">challenge: {ch}</p>
                <button type="button" onClick={() => setK((n) => n + 1)} className="mt-2 min-h-11 rounded-md border border-[var(--line-strong)] px-3 text-sm">
                  New challenge
                </button>
              </FlowStep>
              <FlowArrow label="challenge + rpId" accent={ACCENT} active={stage === 1} />
              <FlowStep n={2} title="Add the page's real origin" what="The browser, not the page, writes where the request came from. A page can only ask for keys for its own domain." accent={ACCENT} active={stage === 1}>
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px]">{JSON.stringify(JSON.parse(r.clientData), null, 1)}</pre>
              </FlowStep>
              <FlowArrow label="clientData hash" accent={ACCENT} active={stage === 2} />
              <FlowStep n={3} title="Unlock the authenticator" what="A fingerprint, face or device PIN proves the person holding the device is its owner. It is checked on the device and never sent." accent={ACCENT} active={stage === 2}>
                <Choices accent={ACCENT} value={uv ? "ok" : "fail"} onChange={(v) => setUv(v === "ok")} options={[{ id: "ok", label: "Fingerprint matches" }, { id: "fail", label: "Someone else's finger" }]} />
              </FlowStep>
              <FlowArrow label={register ? "new key pair" : `key for ${r.rpId}`} accent={ACCENT} active={stage === 3} />
              <FlowStep n={4} title={register ? "Make a key pair for this site" : "Sign with this site's key"} what={register ? "A new key pair, bound to the rpId. The private key stays on the device; the public key goes back." : "The authenticator looks up the key for this rpId and signs the challenge and origin with it."} accent={ACCENT} active={stage === 3}>
                {!r.unlocked && <p className="text-sm" style={{ color: "var(--bad)" }}>Locked: no key is used.</p>}
                {r.unlocked && !r.hasKey && <p className="text-sm" style={{ color: "var(--good)" }}>No passkey for {r.rpId}. The look-alike gets nothing it could replay at the real bank.</p>}
                {r.unlocked && r.hasKey && register && <p className="font-mono text-xs">public key: n = {CREDENTIAL.n}, e = {CREDENTIAL.e}</p>}
                {r.unlocked && r.hasKey && !register && r.hash !== null && (
                  <p className="break-all font-mono text-xs">hash(rpId, clientData) = {r.hash}; signature = {r.hash}^{CREDENTIAL.d} mod {CREDENTIAL.n} = {r.signature}</p>
                )}
              </FlowStep>
              <FlowArrow label={register ? "credential id + public key" : "signature + clientData"} accent={ACCENT} active={stage === 4} />
              <FlowStep n={5} title={register ? "Store the public key" : "Verify on the server"} what={register ? "The site saves the credential id and public key against Ada's account. Nothing secret is stored." : "The site checks the signature with the stored public key, and that the challenge and origin are its own."} accent={ACCENT} active={stage === 4}>
                {!register && r.recovered !== null && <p className="break-all font-mono text-xs">{r.signature}^{CREDENTIAL.e} mod {CREDENTIAL.n} = {r.recovered}</p>}
                <p className="mt-1 text-sm" style={{ color: r.ok ? "var(--good)" : "var(--bad)" }}>{r.ok ? (register ? "Passkey saved." : "Signed in.") : "No sign-in."}</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
