"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type NodeState } from "@/components/system/SystemMap";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import {
  CLIENT_SECRET,
  CLIENT_SHARE,
  G,
  P,
  SCENARIOS,
  SERVER_SECRET,
  SERVER_SHARE,
  SHARED,
  VIEWERS,
  messages,
  scramble,
  type Protection,
  type Scenario,
  type Viewer,
} from "@/lib/tlsHandshake";

const ACCENT = "var(--sec)";
const PROTECTION: Record<Protection, string> = { plain: "in the clear", handshake: "handshake keys", app: "application keys" };

export default function TlsHandshakeDemo() {
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [viewer, setViewer] = useState<Viewer>("browser");
  return (
    <SessionPage>
      <SessionHeader
        kicker="Security · interactive"
        title="The TLS handshake"
        blurb="Before your browser sends a single byte of a page request over HTTPS, it and the server agree on keys and the server proves who it is. In TLS 1.3 this takes one round trip, and everything after the two hello messages is encrypted. Step through the messages and switch between what the browser reads and what the café Wi-Fi sees."
      />
      <div className="mt-6">
        <Run key={scenario} scenario={scenario} setScenario={setScenario} viewer={viewer} setViewer={setViewer} />
      </div>
    </SessionPage>
  );
}

function Run({
  scenario,
  setScenario,
  viewer,
  setViewer,
}: {
  scenario: Scenario;
  setScenario: (s: Scenario) => void;
  viewer: Viewer;
  setViewer: (v: Viewer) => void;
}) {
  const list = messages(scenario);
  const playback = usePlayback(list.length, 1600);
  const cur = list[playback.i];
  const shown = list.slice(0, playback.i + 1);
  const step = cur.step;
  const keysReady = playback.i >= 1;
  const failed = scenario === "fake-cert" && cur.id === "alert";
  const done = scenario === "normal" && playback.atEnd;

  const path = cur.from === "browser" ? ["browser", "wifi", "server"] : ["server", "wifi", "browser"];
  const packets = hops(`${scenario}-${cur.id}-${playback.i}`, path, {
    label: cur.protection === "plain" ? cur.name : "encrypted",
    tone: cur.bad ? "bad" : cur.protection === "plain" ? "accent" : "good",
  });
  const browserState: NodeState = failed ? "bad" : done ? "good" : cur.from === "browser" ? "active" : "idle";

  const caption =
    viewer === "observer"
      ? `${cur.name} (${cur.bytes.toLocaleString("en-US")} bytes, ${PROTECTION[cur.protection]}). The Wi-Fi sees: ${cur.seen}`
      : `${cur.name}: ${cur.body.replace(/\.$/, "")}.`;

  return (
    <SessionLayout
      visual={
        <div className="min-w-0 space-y-3">
          <SystemMap
            chrome="split"
            title="A browser, the café Wi-Fi in between, and the shop's server"
            accent={ACCENT}
            nodes={[
              { id: "browser", label: "Browser", sub: keysReady ? `key ${SHARED}` : "no keys yet", at: [13, 50], mobileAt: [50, 13], state: browserState },
              { id: "wifi", label: "Café Wi-Fi", sub: cur.protection === "plain" ? "can read this" : "sees bytes only", at: [50, 50], state: cur.protection === "plain" ? "wait" : "idle" },
              { id: "server", label: "shop.example", sub: keysReady ? `key ${SHARED}` : "no keys yet", at: [87, 50], mobileAt: [50, 87], state: scenario === "fake-cert" ? "bad" : cur.from === "server" ? "active" : "idle" },
            ]}
            links={[
              { from: "browser", to: "wifi", label: cur.protection === "plain" ? "plain" : "encrypted" },
              { from: "wifi", to: "server", label: cur.protection === "plain" ? "plain" : "encrypted" },
            ]}
            packets={packets}
            aspect={2.6}
            mobileAspect={0.9}
          />
          <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 sm:p-4" aria-label="Messages so far">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">
              {viewer === "browser" ? "As the browser and server read it" : "As the Wi-Fi sees it"}
            </p>
            <ol className="mt-2 space-y-1.5">
              {shown.map((m, i) => {
                const hidden = viewer === "observer" && m.protection !== "plain";
                return (
                  <li
                    key={m.id}
                    className="min-w-0 rounded-md border-l-2 bg-[var(--inset)] px-2 py-1.5"
                    style={{ borderColor: m.bad ? "var(--bad)" : m.protection === "plain" ? ACCENT : "var(--good)", opacity: i === playback.i ? 1 : 0.7 }}
                  >
                    <p className="flex flex-wrap justify-between gap-x-2 text-[11px] text-[var(--muted)]">
                      <span>{m.from === "browser" ? "Browser → server" : "Server → browser"} · {m.name}</span>
                      <span>{PROTECTION[m.protection]}</span>
                    </p>
                    <p className="break-all font-mono text-xs" style={{ color: m.bad && !hidden ? "var(--bad)" : undefined }}>
                      {hidden ? `${scramble(m.id + m.body, 32)}… (${m.bytes.toLocaleString("en-US")} bytes)` : m.body}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      }
      panel={
        <SystemMapPanel caption={caption}>
          <Choices label="Who is answering" accent={ACCENT} value={scenario} onChange={setScenario} options={SCENARIOS} />
          <Choices label="Show" accent={ACCENT} value={viewer} onChange={setViewer} options={VIEWERS} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next message" status={`message ${playback.i + 1} of ${list.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Say hello with a key share" what="The browser lists what it supports and sends its half of a key exchange right away, guessing the server will accept it." accent={ACCENT} active={step === 0}>
            <p className="font-mono text-xs">key_share = {G}^{CLIENT_SECRET} mod {P} = {CLIENT_SHARE}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">The secret {CLIENT_SECRET} stays in the browser. The site name travels in the clear (unless Encrypted Client Hello is used).</p>
          </FlowStep>
          <FlowArrow label={`ClientHello, share ${CLIENT_SHARE}`} accent={ACCENT} active={step === 1} />
          <FlowStep n={2} title="Answer with the server's share" what="The server picks a cipher and sends its own half. This is the last message anyone else can read." accent={ACCENT} active={step === 1}>
            <p className="font-mono text-xs">key_share = {G}^{SERVER_SECRET} mod {P} = {SERVER_SHARE}</p>
          </FlowStep>
          <FlowArrow label={`ServerHello, share ${SERVER_SHARE}`} accent={ACCENT} active={step === 2} />
          <FlowStep n={3} title="Derive the handshake keys" what={`Each side combines its own secret with the other's share and gets the same number. Watchers saw only ${CLIENT_SHARE} and ${SERVER_SHARE}.`} accent={ACCENT} active={step === 2}>
            <p className="font-mono text-xs">browser: {SERVER_SHARE}^{CLIENT_SECRET} mod {P} = {SHARED}</p>
            <p className="font-mono text-xs">server: {CLIENT_SHARE}^{SERVER_SECRET} mod {P} = {SHARED}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Real TLS uses X25519 with 32-byte shares, then HKDF to turn the secret into keys.</p>
          </FlowStep>
          <FlowArrow label="encrypted from here" accent={ACCENT} active={step === 3} />
          <FlowStep n={4} title="Prove the server's identity" what="The server sends its certificate and signs the handshake so far with the certificate's private key. The browser checks the chain to a trusted root." accent={ACCENT} active={step === 3}>
            <p className="text-sm" style={{ color: scenario === "fake-cert" ? "var(--bad)" : "var(--good)" }}>
              {scenario === "fake-cert"
                ? "The impostor's certificate doesn't chain to a trusted root. The browser sends an alert and stops. No request is ever sent."
                : "Chain checks out to ISRG Root X1, the name matches, and the signature proves the server holds the key."}
            </p>
          </FlowStep>
          <FlowArrow label="Finished" accent={ACCENT} active={step === 4} />
          <FlowStep n={5} title="Confirm nothing was changed" what="Both sides send a Finished message: a MAC over every handshake message. If anyone altered a hello, the MACs won't match." accent={ACCENT} active={step === 4}>
            <p className="text-xs text-[var(--muted)]">This stops a downgrade to weaker ciphers: the hellos are covered too.</p>
          </FlowStep>
          <FlowArrow label="application keys" accent={ACCENT} active={step === 5} />
          <FlowStep n={6} title="Send the first encrypted request" what="New keys derived from the same secret protect the HTTP request and the page. One round trip after the hello, data flows." accent={ACCENT} active={step === 5}>
            <p className="text-xs text-[var(--muted)]">The Wi-Fi still sees the server&apos;s IP address, the name in the hello, timing and sizes. Not the path, cookies or content.</p>
          </FlowStep>
        </>
      }
    />
  );
}
