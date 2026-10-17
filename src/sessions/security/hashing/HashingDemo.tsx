"use client";

import { useEffect, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { TWEAKS, compare, pad, toHex, type Tweak } from "@/lib/hashing";

const ACCENT = "var(--sec)";
const SHOW_BYTES = 24;

export default function HashingDemo() {
  const [text, setText] = useState("hello");
  const [tweak, setTweak] = useState<Tweak>("case");
  const walk = useWalk(5, 700);
  const r = compare(text, tweak);
  const same = tweak === "same";

  // Cross-check the hand-written SHA-256 with the browser's own (async, so it runs in an effect).
  const [check, setCheck] = useState<{ text: string; hex: string } | null>(null);
  useEffect(() => {
    let live = true;
    if (!globalThis.crypto?.subtle) return;
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then((buf) => {
      if (live) setCheck({ text, hex: toHex(Array.from(new Uint8Array(buf))) });
    });
    return () => {
      live = false;
    };
  }, [text]);
  const browserMatch = check && check.text === text ? check.hex === r.hexA : null;

  const padded = pad(r.a);
  const at = walk.stage;
  const caption = same
    ? `Same input, same output: both hashes are ${r.hexA.slice(0, 12)}…, every one of the 256 bits identical.`
    : `${r.inputBitsChanged} input bit${r.inputBitsChanged === 1 ? "" : "s"} changed. ${r.flipped} of 256 output bits flipped (${Math.round((r.flipped / 256) * 100)}%). About half is what a good hash should do.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Security · interactive"
        title="Hash functions"
        blurb="A hash turns any input into a fixed-size fingerprint. SHA-256 always gives 256 bits. The same input always gives the same hash, and a change of a single bit gives a completely different one. This page runs real SHA-256 on what you type."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The two hashes, bit by bit">
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <HashBox label={`SHA-256("${clip(text)}")`} hex={r.hexA} other={r.hexB} />
                <HashBox label={`SHA-256("${clip(r.textB)}")`} hex={r.hexB} other={r.hexA} />
              </div>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">256 output bits · changed bits lit</p>
              <div
                className="mt-2 grid gap-[2px]"
                style={{ gridTemplateColumns: "repeat(32, minmax(0, 1fr))" }}
                role="img"
                aria-label={`${r.flipped} of 256 bits differ`}
              >
                {r.diff.map((d, i) => (
                  <span
                    key={i}
                    className="aspect-square rounded-[2px] transition-colors duration-300"
                    style={{ background: d ? ACCENT : r.bb[i] ? "var(--line-strong)" : "var(--inset)" }}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                <span>
                  <b className="font-mono text-sm" style={{ color: ACCENT }}>{r.flipped}</b> / 256 bits flipped
                </span>
                <span className="flex items-center gap-1"><Swatch bg={ACCENT} /> changed</span>
                <span className="flex items-center gap-1"><Swatch bg="var(--line-strong)" /> 1, same</span>
                <span className="flex items-center gap-1"><Swatch bg="var(--inset)" /> 0, same</span>
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <label className="block w-full min-w-0">
                <span className="text-sm font-medium">Your text</span>
                <input
                  value={text}
                  maxLength={200}
                  onChange={(e) => setText(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-md border border-[var(--line-strong)] bg-[var(--inset)] px-3 font-mono text-sm"
                />
              </label>
              <div className="w-full">
                <Choices label="Second input: change it a little" accent={ACCENT} value={tweak} onChange={setTweak} options={TWEAKS} />
              </div>
              <RunButton busy={walk.busy} onClick={walk.run} accent={ACCENT} running="Hashing…">
                Walk through SHA-256
              </RunButton>
              <span className="text-xs text-[var(--faint)]">
                {browserMatch === null ? "Checking against your browser's crypto.subtle…" : browserMatch ? "Matches your browser's crypto.subtle SHA-256 ✓" : "Differs from crypto.subtle"}
              </span>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Turn the text into bytes" what="Text is stored as UTF-8: one byte for plain letters, two to four for others." accent={ACCENT} active={at === 0}>
                <ByteRow label="A" bytes={r.a} changed={r.changed} />
                <ByteRow label="B" bytes={r.b} changed={r.changed} />
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {same ? "Identical bytes." : `${r.changed.length} byte${r.changed.length === 1 ? "" : "s"} differ, ${r.inputBitsChanged} bit${r.inputBitsChanged === 1 ? "" : "s"} in total.`}
                </p>
              </FlowStep>
              <FlowArrow label={`${r.a.length} bytes`} accent={ACCENT} active={at === 1} />
              <FlowStep n={2} title="Pad to whole 64-byte blocks" what="Add one 1 bit, then zeros, then the input length, until the total is a multiple of 64 bytes." accent={ACCENT} active={at === 1}>
                <PadBar data={r.a.length} total={padded.length} />
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {r.a.length} data + 1 marker + {padded.length - r.a.length - 9} zeros + 8 length = {padded.length} bytes = {r.blocksA} block{r.blocksA === 1 ? "" : "s"}
                </p>
              </FlowStep>
              <FlowArrow label={`${r.blocksA} × 64 bytes`} accent={ACCENT} active={at === 2} />
              <FlowStep n={3} title="Mix each block for 64 rounds" what="Each round rotates, XORs and adds 32-bit words, so every input bit ends up touching every output bit." accent={ACCENT} active={at === 2}>
                <p className="font-mono text-sm">{r.blocksA * 64} rounds for A · {r.blocksB * 64} for B</p>
                <p className="mt-1 text-xs text-[var(--muted)]">There is no step that can be run backwards: you can&apos;t get the input from the output.</p>
              </FlowStep>
              <FlowArrow label="8 words of 32 bits" accent={ACCENT} active={at === 3} />
              <FlowStep n={4} title="Read out 256 bits" what="The final state is the hash: 32 bytes, shown as 64 hex characters, whatever the input length." accent={ACCENT} active={at === 3}>
                <p className="break-all font-mono text-xs">{r.hexA}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Same length for 1 character or 200.</p>
              </FlowStep>
              <FlowArrow label="two hashes" accent={ACCENT} active={at === 4} />
              <FlowStep n={5} title="Compare the two hashes" what="Equal hashes mean equal inputs. Any change flips about half the bits, so a hash shows nothing about how close two inputs were." accent={ACCENT} active={at === 4}>
                <p className="font-mono text-sm" style={{ color: same ? "var(--good)" : ACCENT }}>
                  {same ? "Identical: 0 bits differ" : `${r.flipped} of 256 bits differ`}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">Used for file checksums, Git object ids, signatures and HMAC. Passwords need a slow hash instead (bcrypt, Argon2).</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

const clip = (s: string) => (s.length > 14 ? `${s.slice(0, 14)}…` : s);

function HashBox({ label, hex, other }: { label: string; hex: string; other: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--line)] bg-[var(--inset)] p-2.5">
      <p className="truncate font-mono text-[11px] text-[var(--faint)]">{label}</p>
      <p className="mt-1 break-all font-mono text-xs leading-5">
        {hex.split("").map((c, i) => (
          <span key={i} style={c !== other[i] ? { color: ACCENT, fontWeight: 600 } : { color: "var(--muted)" }}>
            {c}
          </span>
        ))}
      </p>
    </div>
  );
}

function ByteRow({ label, bytes, changed }: { label: string; bytes: number[]; changed: number[] }) {
  const shown = bytes.slice(0, SHOW_BYTES);
  return (
    <p className="mt-1 flex min-w-0 gap-2 font-mono text-xs">
      <span className="shrink-0 text-[var(--faint)]">{label}</span>
      <span className="min-w-0 break-all">
        {shown.map((b, i) => (
          <span key={i} className="mr-1" style={changed.includes(i) ? { color: ACCENT, fontWeight: 600 } : undefined}>
            {b.toString(16).padStart(2, "0")}
          </span>
        ))}
        {bytes.length > SHOW_BYTES && <span className="text-[var(--faint)]">… +{bytes.length - SHOW_BYTES}</span>}
        {bytes.length === 0 && <span className="text-[var(--faint)]">(empty)</span>}
      </span>
    </p>
  );
}

function PadBar({ data, total }: { data: number; total: number }) {
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-4 w-full overflow-hidden rounded bg-[var(--track)]" aria-hidden>
      <span style={{ width: pct(data), background: ACCENT }} />
      <span style={{ width: pct(1), background: "var(--c2)" }} />
      <span style={{ width: pct(total - data - 9) }} />
      <span style={{ width: pct(8), background: "var(--c1)" }} />
    </div>
  );
}

function Swatch({ bg }: { bg: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-[2px] border border-[var(--line)]" style={{ background: bg }} />;
}
