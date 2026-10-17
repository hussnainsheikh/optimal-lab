"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { Choices } from "@/components/session/ui";
import { FLOATS, PLACES, add, double, signed, sumVersusPoint3, toBits, unsigned, type FloatId } from "@/lib/binaryNumbers";

const ACCENT = "var(--os)";
const SUM = sumVersusPoint3();

type Focus = "bits" | "add" | "float" | "sum";
const STEP_OF: Record<Focus, number> = { bits: 0, add: 3, float: 4, sum: 5 };

export default function BinaryNumbersDemo() {
  const [u, setU] = useState(5);
  const [focus, setFocus] = useState<Focus>("bits");
  const [last, setLast] = useState<string | null>(null);
  const [floatId, setFloatId] = useState<FloatId>("0.1");
  const bits = toBits(u);
  const s = signed(bits);
  const fl = FLOATS.find((x) => x.id === floatId)!;
  const d = double(fl.value);
  const on = (k: number) => (focus === "bits" ? k <= 2 : STEP_OF[focus] === k);

  function flip(i: number) {
    setU(u ^ PLACES[i]);
    setFocus("bits");
    setLast(null);
  }
  function step(k: number) {
    const r = add(u, k);
    setU(r.result);
    setFocus("add");
    const what = `${unsigned(bits)} ${k > 0 ? "+" : "−"} 1`;
    if (r.carry) setLast(`${what}: the result needs 9 bits. The 9th is dropped, so unsigned wraps around to ${r.result}.`);
    else if (r.overflow) setLast(`${what}: the bits are fine as unsigned (${r.result}), but as signed ${s} ${k > 0 ? "+" : "−"} 1 became ${signed(toBits(r.result))}. Signed overflow.`);
    else setLast(`${what} = ${r.result}. No wrap.`);
  }

  const caption =
    focus === "float" ? `${fl.label} is stored as ${d.hex}. Its exact value is ${d.exact.length > 30 ? d.exact.slice(0, 30) + "…" : d.exact}.`
    : focus === "sum" ? `0.1 + 0.2 gives ${SUM.shown}, and 0.3 is stored as 0.29999999999999998…: two different doubles, so == says false.`
    : last ?? `${bits.join("")} reads as ${u} unsigned and ${s} signed. Tap a bit to flip it.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Numbers in binary"
        blurb="Memory only holds bits. The same 8 bits can mean 200 or −56 depending on how you read them, adding 1 can wrap to 0, and most decimal fractions can't be stored exactly. Flip the bits and see."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="An 8-bit register and a 64-bit double">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">8-bit register · tap a bit</p>
              <div className="mt-2 grid grid-cols-8 gap-1">
                {bits.map((b, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => flip(i)}
                    aria-label={`Bit worth ${i === 0 ? "128 (or −128 signed)" : PLACES[i]}: ${b}`}
                    className="min-h-11 min-w-0 rounded-md border font-mono text-lg tabular-nums transition-colors"
                    style={{ borderColor: b ? ACCENT : "var(--line)", background: b ? `color-mix(in srgb, ${ACCENT} 18%, transparent)` : "var(--inset)" }}
                  >
                    {b}
                  </button>
                ))}
                {PLACES.map((p, i) => (
                  <span key={p} className="text-center font-mono text-[10px] text-[var(--faint)]">{i === 0 ? "128/−128" : p}</span>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-sm">
                <p className="rounded bg-[var(--inset)] px-3 py-2">unsigned <span className="block text-2xl tabular-nums">{u}</span></p>
                <p className="rounded bg-[var(--inset)] px-3 py-2">signed <span className="block text-2xl tabular-nums" style={{ color: s < 0 ? "var(--bad)" : undefined }}>{s}</span></p>
              </div>

              <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">64-bit double: {fl.label}</p>
              <p className="mt-2 break-all font-mono text-[11px] leading-5">
                <span style={{ color: "var(--c4)" }}>{d.sign}</span>{" "}
                <span style={{ color: "var(--c2)" }}>{d.exponentBits}</span>{" "}
                <span style={{ color: "var(--c1)" }}>{d.mantissaBits}</span>
              </p>
              <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-[var(--muted)]">
                <span><span style={{ color: "var(--c4)" }}>■</span> sign</span>
                <span><span style={{ color: "var(--c2)" }}>■</span> exponent: 2^{d.exponent}</span>
                <span><span style={{ color: "var(--c1)" }}>■</span> 52 fraction bits</span>
              </p>
              <p className="mt-2 break-all font-mono text-xs">stored exactly: {d.exact}</p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <button type="button" onClick={() => step(1)} className="min-h-11 rounded-md px-4 text-sm font-semibold text-[var(--on-accent)]" style={{ background: ACCENT }}>+ 1</button>
              <button type="button" onClick={() => step(-1)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm">− 1</button>
              {[127, 255, 0].map((v) => (
                <button key={v} type="button" onClick={() => { setU(v); setFocus("bits"); setLast(null); }} className="min-h-11 rounded-md border border-[var(--line)] px-3 font-mono text-sm text-[var(--muted)]">
                  set {v}
                </button>
              ))}
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Flip bits to make a number" what="Each bit is worth twice the one to its right: 1, 2, 4 … 128. A number is the sum of the places that hold a 1." accent={ACCENT} active={on(0)}>
                <p className="font-mono text-xs">{bits.map((b, i) => (b ? PLACES[i] : null)).filter((x) => x !== null).join(" + ") || "0"} = {u}</p>
              </FlowStep>
              <FlowArrow label="8 bits" accent={ACCENT} />
              <FlowStep n={2} title="Read them as unsigned" what="Unsigned means no minus sign: 8 bits cover 0 to 255." accent={ACCENT} active={on(1)}>
                <p className="font-mono text-xs">{bits.join("")} → {u}</p>
              </FlowStep>
              <FlowArrow label="same 8 bits" accent={ACCENT} />
              <FlowStep n={3} title="Read them as signed" what="Two's complement makes the top bit worth −128 instead of +128. Now 8 bits cover −128 to 127, and the CPU adds them with the same circuit." accent={ACCENT} active={on(2)}>
                <p className="font-mono text-xs">{bits[0] ? `−128 + ${u - 128}` : `${u}`} = {s}</p>
              </FlowStep>
              <FlowArrow label="add 1" accent={ACCENT} />
              <FlowStep n={4} title="Add 1 and watch it wrap" what="There is no 9th bit to carry into. 255 + 1 becomes 0, and 127 + 1 becomes −128 when read as signed. This is integer overflow." accent={ACCENT} active={on(3)}>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => step(1)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-3 text-sm">+ 1</button>
                  <button type="button" onClick={() => { setU(127); setFocus("bits"); setLast(null); }} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">start at 127</button>
                  <button type="button" onClick={() => { setU(255); setFocus("bits"); setLast(null); }} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">start at 255</button>
                </div>
                {last && <p className="mt-2 text-xs text-[var(--muted)]">{last}</p>}
              </FlowStep>
              <FlowArrow label="now a fraction" accent={ACCENT} />
              <FlowStep n={5} title="Store a fraction in 64 bits" what="A double (IEEE 754) stores a sign, a power of two and 52 bits of fraction. 0.5 and 0.75 are sums of powers of two, so they fit exactly. 0.1 repeats forever in binary, so it is rounded." accent={ACCENT} active={on(4)}>
                <Choices accent={ACCENT} value={floatId} options={FLOATS.map(({ id, label }) => ({ id, label }))} onChange={(id) => { setFloatId(id); setFocus("float"); }} />
                <p className="mt-2 break-all font-mono text-xs">{d.hex} = {d.exact}</p>
              </FlowStep>
              <FlowArrow label="two rounded doubles" accent={ACCENT} />
              <FlowStep n={6} title="Add 0.1 and 0.2" what="The sum of two rounded numbers is rounded again, and lands one step above the double closest to 0.3. Compare money in whole cents, or compare floats within a small tolerance." accent={ACCENT} active={on(5)}>
                <button type="button" onClick={() => { setFloatId("sum"); setFocus("sum"); }} className="min-h-11 rounded-md border border-[var(--line-strong)] px-3 text-sm">Compare 0.1 + 0.2 with 0.3</button>
                <dl className="mt-2 space-y-1 break-all font-mono text-[11px]">
                  <div><dt className="inline text-[var(--faint)]">0.1 + 0.2 = </dt><dd className="inline">{SUM.sumExact}</dd></div>
                  <div><dt className="inline text-[var(--faint)]">0.3 = </dt><dd className="inline">{SUM.point3Exact}</dd></div>
                  <div><dt className="inline text-[var(--faint)]">equal? </dt><dd className="inline" style={{ color: SUM.equal ? "var(--good)" : "var(--bad)" }}>{String(SUM.equal)}</dd> <span className="text-[var(--faint)]">(gap {SUM.gap.toExponential(3)} = 2^−54)</span></div>
                </dl>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
