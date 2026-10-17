"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { Choices, Slider } from "@/components/session/ui";
import {
  LCG_A,
  LCG_C,
  SOURCES,
  START_SECONDS,
  cryptoToken,
  guessTime,
  predictNext,
  predictableToken,
  streamEncrypt,
  xorBytes,
  type Source,
} from "@/lib/randomness";

const ACCENT = "var(--sec)";
const USERS = ["Ada", "Ben", "Chen", "Dami", "Eve", "Femi", "Gus", "Hana"];
const MSG_A = "PAY ALICE 100";
const MSG_B = "PAY BOB 9000!";

export default function RandomnessDemo() {
  const [source, setSource] = useState<Source>("lcg");
  const [issued, setIssued] = useState<string[]>([]);
  const [bits, setBits] = useState(128);
  const [reuse, setReuse] = useState(true);
  const [focus, setFocus] = useState(0);

  function pick(s: Source) {
    setSource(s);
    setIssued([]);
    setFocus(0);
  }
  function issue() {
    setIssued((list) => {
      if (list.length >= USERS.length) return list;
      const next = source === "crypto" ? cryptoToken(16) : predictableToken(source, list.length);
      return [...list, next];
    });
    setFocus(issued.length === 0 ? 1 : 2);
  }

  const last = issued[issued.length - 1];
  const guess = predictNext(source, last);
  const hits = issued.filter((t, i) => i > 0 && predictNext(source, issued[i - 1]) === t).length;
  const tokenBits = source === "crypto" ? 128 : 32;
  const unknown = source === "crypto" ? bits : 0;
  const time = guessTime(bits, 1000);

  const c1 = streamEncrypt(MSG_A, 7, 41);
  const c2 = streamEncrypt(MSG_B, 7, reuse ? 41 : 42);
  const x = xorBytes(c1, c2);
  const zeros = x.filter((b) => b === 0).length;

  const caption =
    issued.length === 0
      ? "Press “Issue a reset token” to send password-reset links to users, one at a time."
      : source === "crypto"
        ? `${issued.length} token${issued.length === 1 ? "" : "s"} issued. Seeing them tells you nothing about the next: each is 128 fresh random bits.`
        : `${issued.length} token${issued.length === 1 ? "" : "s"} issued. From the last one alone, the next is ${guess}. ${hits > 0 ? `That guess was right ${hits} time${hits === 1 ? "" : "s"} so far.` : "Issue another to check."}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Security · interactive"
        title="Randomness and nonces"
        blurb="Reset links, session ids, API keys and encryption nonces only work if nobody can guess them. A random number that looks random but can be predicted is as bad as no secret at all. Issue reset tokens from three sources and see which ones an observer can predict."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Reset tokens issued by the server">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Reset links sent · {tokenBits}-bit tokens</p>
                <p className="text-xs text-[var(--muted)]">{SOURCES.find((s) => s.id === source)!.label}</p>
              </div>
              <ol className="mt-3 space-y-1.5">
                {issued.map((t, i) => {
                  const predicted = i > 0 ? predictNext(source, issued[i - 1]) : null;
                  const hit = predicted === t;
                  return (
                    <li key={i} className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-[var(--inset)] px-2 py-1.5">
                      <span className="text-xs text-[var(--muted)]">{USERS[i]}</span>
                      <span className="break-all font-mono text-xs">/reset?token={t}</span>
                      <span className="text-xs" style={{ color: i === 0 ? "var(--faint)" : hit ? "var(--bad)" : "var(--good)" }}>
                        {i === 0 ? "first" : hit ? "guessed" : "unguessable"}
                      </span>
                    </li>
                  );
                })}
                {issued.length === 0 && <li className="rounded-md bg-[var(--inset)] px-2 py-3 text-sm text-[var(--muted)]">No tokens yet.</li>}
              </ol>
              {issued.length > 0 && issued.length < USERS.length && (
                <p className="mt-3 rounded-md border border-dashed border-[var(--line-strong)] px-2 py-1.5 text-xs">
                  Next ({USERS[issued.length]}), predicted from {USERS[issued.length - 1]}&apos;s token:{" "}
                  <span className="break-all font-mono" style={{ color: guess ? "var(--bad)" : "var(--good)" }}>{guess ?? "no way to tell"}</span>
                </p>
              )}
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <button
                type="button"
                onClick={issue}
                disabled={issued.length >= USERS.length}
                className="min-h-11 rounded-md px-4 text-sm font-semibold text-[var(--on-accent)] disabled:opacity-50"
                style={{ background: ACCENT }}
              >
                Issue a reset token
              </button>
              <button type="button" onClick={() => pick(source)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm">
                Start over
              </button>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Pick where randomness comes from" what="A counter or a seeded formula only looks random. The operating system's crypto generator mixes in real unpredictable events." accent={ACCENT} active={focus === 0}>
                <Choices accent={ACCENT} value={source} onChange={pick} options={SOURCES} />
                <p className="mt-2 break-all font-mono text-xs text-[var(--muted)]">
                  {source === "counter" && "token = last token + 1"}
                  {source === "lcg" && `x = (${LCG_A}·x + ${LCG_C}) mod 2^31, seeded with the start time ${START_SECONDS}`}
                  {source === "crypto" && "crypto.getRandomValues(16 bytes), backed by the OS (getrandom, /dev/urandom)"}
                </p>
              </FlowStep>
              <FlowArrow label="a new value" accent={ACCENT} active={focus === 1} />
              <FlowStep n={2} title="Send a token to a user" what="The server puts the token in a reset link and emails it. Anyone holding the link can set a new password." accent={ACCENT} active={focus === 1}>
                <p className="break-all font-mono text-xs">{last ? `${USERS[issued.length - 1]}: ${last}` : "Nothing sent yet."}</p>
              </FlowStep>
              <FlowArrow label="tokens other people have seen" accent={ACCENT} active={focus === 2} />
              <FlowStep n={3} title="Ask: can the next one be worked out?" what="Someone who requests their own reset link sees one token. If that reveals the generator's state, the next user's link is known too." accent={ACCENT} active={focus === 2}>
                <p className="text-sm" style={{ color: source === "crypto" ? "var(--good)" : "var(--bad)" }}>
                  {source === "counter" && "Yes: add one."}
                  {source === "lcg" && "Yes: the token is the generator's whole state. Run the formula once more."}
                  {source === "crypto" && "No: past outputs say nothing about future ones."}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">Language rand() and Math.random() functions are built for speed and simulations, not secrets.</p>
              </FlowStep>
              <FlowArrow label={`${unknown} unknown bits`} accent={ACCENT} active={focus === 3} />
              <FlowStep n={4} title="Make it long enough to guess blindly" what="With a good source, the only option left is guessing. Each extra bit doubles the work." accent={ACCENT} active={focus === 3}>
                <Slider label="Token length" value={bits} min={16} max={256} step={16} format={(v) => `${v} bits`} onChange={(v) => { setBits(v); setFocus(3); }} accent={ACCENT} hint="At 1,000 guesses a second against a login endpoint" />
                <p className="mt-2 font-mono text-sm">{time.label} on average</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{source === "crypto" ? "128 bits or more is the usual choice." : "Length doesn't help a predictable source: a 256-bit counter is still a counter."}</p>
              </FlowStep>
              <FlowArrow label="a nonce" accent={ACCENT} active={focus === 4} />
              <FlowStep n={5} title="Use each nonce once" what="A nonce is a number used once. Ciphers like AES-GCM and ChaCha20 turn (key, nonce) into a mask. Reuse the nonce and two messages share the mask." accent={ACCENT} active={focus === 4}>
                <Choices accent={ACCENT} value={reuse ? "same" : "fresh"} onChange={(v) => { setReuse(v === "same"); setFocus(4); }} options={[{ id: "same", label: "Same nonce twice" }, { id: "fresh", label: "Fresh nonce each time" }]} />
                <p className="mt-2 text-xs text-[var(--muted)]">ciphertext 1 ⊕ ciphertext 2:</p>
                <p className="mt-1 flex flex-wrap gap-1 font-mono text-[11px]">
                  {x.map((b, i) => (
                    <span key={i} className="rounded px-1" style={{ background: b === 0 && reuse ? "color-mix(in srgb, var(--bad) 25%, transparent)" : "var(--inset)" }}>
                      {b.toString(16).padStart(2, "0")}
                    </span>
                  ))}
                </p>
                <p className="mt-2 text-sm" style={{ color: reuse ? "var(--bad)" : "var(--good)" }}>
                  {reuse
                    ? `The key cancels out, leaving message 1 ⊕ message 2. The ${zeros} zero bytes show exactly where “${MSG_A}” and “${MSG_B}” have the same letters.`
                    : "Different masks: the XOR is noise and says nothing about either message."}
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
