"use client";

import { useEffect, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import {
  H,
  MODES,
  PLAIN,
  W,
  aesDecrypt,
  aesEncrypt,
  aesKey,
  bytesHex,
  counterBlock,
  decrypt,
  encrypt,
  encryptBlock,
  hex4,
  looks,
  patternStats,
  roundKeys,
  type Mode,
} from "@/lib/symmetricEncryption";

const ACCENT = "var(--sec)";

type Sealed = { nonce: Uint8Array; data: Uint8Array; plain: string | null };

export default function SymmetricDemo() {
  const [key, setKey] = useState(4242);
  const [mode, setMode] = useState<Mode>("ecb");
  const [nonce, setNonce] = useState(9);
  const [bobRight, setBobRight] = useState(true);
  const walk = useWalk(6, 800);
  const at = walk.stage;

  const cipher = encrypt(PLAIN, key, mode, nonce);
  const bobKey = bobRight ? key : (key + 1) % 65536;
  const back = decrypt(cipher, bobKey, mode, nonce);
  const roundTrip = back.every((b, i) => b === PLAIN[i]);
  const stats = patternStats(cipher);

  const caption =
    mode === "ecb"
      ? `ECB: equal blocks give equal ciphertext. The picture uses ${stats.distinct} different ciphertext values, and one of them repeats ${stats.top} times, so the shape shows through.`
      : `CTR: each block is mixed with E(key, nonce ${nonce} + its position). ${stats.distinct} different values out of ${cipher.length} blocks: no pattern left.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Security · interactive"
        title="Symmetric encryption"
        blurb="Alice and Bob share one secret key. The same key locks (encrypts) and unlocks (decrypts). The cipher alone isn't enough: how you apply it to many blocks decides whether patterns leak. The picture uses a toy 16-bit cipher; the last step runs real AES-GCM in your browser."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="A picture before and after encryption">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <Picture title="Plain" blocks={PLAIN} plain />
                <Picture title={mode === "ecb" ? "Encrypted (ECB)" : "Encrypted (CTR)"} blocks={cipher} />
                <Picture title={bobRight ? "Bob decrypts" : "Wrong key"} blocks={back} plain={roundTrip} />
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">
                Each cell is one 16-bit block. Equal ciphertext values get equal colours. {W * H} blocks, key {key}.
              </p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="How blocks are encrypted" accent={ACCENT} value={mode} onChange={setMode} options={MODES} />
              <RunButton busy={walk.busy} onClick={walk.run} accent={ACCENT} running="Encrypting…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Share one secret key" what="Both sides need the same key, agreed in advance or through a key exchange. Anyone with the key can read everything." accent={ACCENT} active={at === 0}>
                <Slider label="Shared key (16 bits here, 256 bits for AES-256)" value={key} min={1} max={65535} step={1} format={(v) => String(v)} onChange={setKey} accent={ACCENT} />
                <p className="mt-2 break-all font-mono text-xs text-[var(--muted)]">round keys: {roundKeys(key).join(", ")}</p>
              </FlowStep>
              <FlowArrow label="key" accent={ACCENT} active={at === 1} />
              <FlowStep n={2} title="Cut the data into blocks" what="A block cipher works on fixed-size pieces: 16 bits in this toy, 128 bits in AES." accent={ACCENT} active={at === 1}>
                <p className="break-all font-mono text-xs">{PLAIN.slice(16, 32).map(hex4).join(" ")}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Row 2 of the picture: background is 0000, ink is ffff. Many blocks are identical.</p>
              </FlowStep>
              <FlowArrow label={`${PLAIN.length} blocks`} accent={ACCENT} active={at === 2} />
              <FlowStep n={3} title="Encrypt each block" what={mode === "ecb" ? "ECB runs the cipher on each block alone. Same block in, same block out." : "CTR encrypts nonce + counter instead, then XORs the result into the data. Every position gets a different mask."} accent={ACCENT} active={at === 2}>
                <ul className="space-y-1 font-mono text-xs">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="break-all">
                      {mode === "ecb"
                        ? `E(${hex4(PLAIN[i])}) = ${hex4(cipher[i])}`
                        : `${hex4(PLAIN[i])} ⊕ E(${hex4(counterBlock(nonce, i))}) = ${hex4(PLAIN[i])} ⊕ ${hex4(encryptBlock(counterBlock(nonce, i), key))} = ${hex4(cipher[i])}`}
                    </li>
                  ))}
                </ul>
                {mode === "ctr" && (
                  <button type="button" onClick={() => setNonce((n) => (n + 37) % 256)} className="mt-3 min-h-11 rounded-md border border-[var(--line-strong)] px-3 text-sm">
                    New nonce (now {nonce})
                  </button>
                )}
                {mode === "ecb" && <p className="mt-2 text-xs text-[var(--muted)]">The first three blocks are all 0000, so all three come out the same.</p>}
              </FlowStep>
              <FlowArrow label={mode === "ctr" ? `ciphertext + nonce ${nonce}` : "ciphertext"} accent={ACCENT} active={at === 3} />
              <FlowStep n={4} title="Send the ciphertext" what="Anyone on the network can copy it. The nonce travels with it in the clear: it only has to be unique, not secret." accent={ACCENT} active={at === 3}>
                <p className="break-all font-mono text-xs">{cipher.slice(16, 32).map(hex4).join(" ")}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {stats.distinct} distinct values in {cipher.length} blocks{mode === "ecb" ? ": an observer can count and map the repeats." : "."}
                </p>
              </FlowStep>
              <FlowArrow label="ciphertext" accent={ACCENT} active={at === 4} />
              <FlowStep n={5} title="Decrypt with the same key" what="Bob runs the cipher backwards (ECB) or rebuilds the same mask and XORs again (CTR)." accent={ACCENT} active={at === 4}>
                <Choices accent={ACCENT} value={bobRight ? "right" : "wrong"} onChange={(v) => setBobRight(v === "right")} options={[{ id: "right", label: `Bob uses key ${key}` }, { id: "wrong", label: `Bob uses key ${(key + 1) % 65536}` }]} />
                <p className="mt-2 text-sm" style={{ color: roundTrip ? "var(--good)" : "var(--bad)" }}>
                  {roundTrip ? "The picture comes back exactly." : mode === "ecb" ? "Garbage, but the shape still shows: ECB leaks even through a wrong key." : "Noise. Off by one in the key and nothing is readable."}
                </p>
              </FlowStep>
              <FlowArrow label="in practice" accent={ACCENT} active={at === 5} />
              <FlowStep n={6} title="Use a real cipher: AES-GCM" what="AES-GCM is counter mode plus a tag that detects any change. Each message needs a fresh 12-byte nonce." accent={ACCENT} active={at === 5}>
                <AesBox />
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Picture({ title, blocks, plain = false }: { title: string; blocks: number[]; plain?: boolean }) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)] sm:text-[11px]">{title}</figcaption>
      <div className="grid gap-px rounded bg-[var(--line)] p-px" style={{ gridTemplateColumns: `repeat(${W}, minmax(0, 1fr))` }} aria-hidden>
        {looks(blocks).map((l, i) => {
          const b = blocks[i];
          const bg = plain ? (b === 0xffff ? "var(--text)" : "var(--panel)") : `color-mix(in srgb, ${l.token} ${l.strength}%, var(--panel))`;
          return <span key={i} className="aspect-square transition-colors duration-300" style={{ background: bg }} />;
        })}
      </div>
    </figure>
  );
}

function AesBox() {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [text, setText] = useState("Meet at 6");
  const [sealed, setSealed] = useState<Sealed[]>([]);

  useEffect(() => {
    let live = true;
    if (!globalThis.crypto?.subtle) return;
    aesKey().then((k) => {
      if (live) setKey(k);
    });
    return () => {
      live = false;
    };
  }, []);

  async function seal() {
    if (!key) return;
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const data = await aesEncrypt(key, text, nonce);
    const plain = await aesDecrypt(key, data, nonce);
    setSealed((s) => [{ nonce, data, plain }, ...s].slice(0, 3));
  }

  async function tamper() {
    if (!key || sealed.length === 0) return;
    const first = sealed[0];
    const data = first.data.slice();
    data[0] ^= 1;
    const plain = await aesDecrypt(key, data, first.nonce);
    setSealed((s) => [{ ...first, data, plain }, ...s.slice(1)]);
  }

  if (!key) return <p className="text-sm text-[var(--muted)]">Making a 256-bit key with WebCrypto…</p>;

  return (
    <div className="min-w-0">
      <label className="block min-w-0">
        <span className="text-sm font-medium">Message</span>
        <input value={text} maxLength={60} onChange={(e) => setText(e.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-[var(--line-strong)] bg-[var(--inset)] px-3 font-mono text-sm" />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={seal} className="min-h-11 rounded-md px-3 text-sm font-semibold text-[var(--on-accent)]" style={{ background: ACCENT }}>
          Encrypt (new nonce)
        </button>
        <button type="button" onClick={tamper} disabled={sealed.length === 0} className="min-h-11 rounded-md border border-[var(--line-strong)] px-3 text-sm disabled:opacity-40">
          Flip one bit of the latest
        </button>
      </div>
      {sealed.length === 0 && <p className="mt-2 text-xs text-[var(--faint)]">Encrypt the same message twice and compare.</p>}
      <ul className="mt-3 space-y-2">
        {sealed.map((s, i) => (
          <li key={`${bytesHex(s.nonce)}-${i}`} className="rounded-md bg-[var(--inset)] p-2 font-mono text-[11px]">
            <p className="break-all text-[var(--muted)]">nonce {bytesHex(s.nonce)}</p>
            <p className="break-all">ciphertext + tag {bytesHex(s.data)}</p>
            <p className="mt-1 font-sans text-xs" style={{ color: s.plain === null ? "var(--bad)" : "var(--good)" }}>
              {s.plain === null ? "Decrypt fails: the tag no longer matches, so the change is caught." : `Decrypts to “${s.plain}”`}
            </p>
          </li>
        ))}
      </ul>
      {sealed.length > 1 && <p className="mt-2 text-xs text-[var(--muted)]">Same message, different nonce, completely different ciphertext. The extra 16 bytes are the tag.</p>}
    </div>
  );
}
