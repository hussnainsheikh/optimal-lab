"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { CVDS, LEVELS, contrast, deltaE, fixText, hexToRgb, rgbToHex, simulate, type Cvd } from "@/lib/contrast";

const ACCENT = "var(--web)";
const QUERY = "(prefers-reduced-motion: reduce)";
const ERROR = "#d33f3f";
const OK = "#3fa34d";
const BORDER_LIGHT = "#c8c8c8";
const BORDER_DARK = "#767676";
const SLIDES = ["Spring sale: 30% off", "Free returns", "New trail runners"];

function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(QUERY);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

export default function ContrastMotionDemo() {
  const [fg, setFg] = useState("#9a9a9a");
  const [bg, setBg] = useState("#ffffff");
  const [darkBorder, setDarkBorder] = useState(false);
  const [cvd, setCvd] = useState<Cvd>("deuteranopia");
  const [icons, setIcons] = useState(false);
  const [simulateReduce, setSimulateReduce] = useState(false);
  const [pausable, setPausable] = useState(false);
  const [paused, setPaused] = useState(false);
  const [slide, setSlide] = useState(0);
  const osReduce = useReducedMotion();
  const reduce = osReduce || simulateReduce;
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;

  const fgRgb = hexToRgb(fg);
  const bgRgb = hexToRgb(bg);
  const ratio = contrast(fgRgb, bgRgb);
  const fix = fixText(fgRgb, bgRgb, 4.5);
  const border = darkBorder ? BORDER_DARK : BORDER_LIGHT;
  const borderRatio = contrast(hexToRgb(border), hexToRgb("#ffffff"));
  const errSim = simulate(hexToRgb(ERROR), cvd);
  const okSim = simulate(hexToRgb(OK), cvd);
  const dE = deltaE(errSim, okSim);
  const autoAdvance = !reduce && !(pausable && paused);

  useEffect(() => {
    if (!autoAdvance) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 3000);
    return () => clearInterval(id);
  }, [autoAdvance]);

  const textOk = ratio >= 4.5;
  const statusOk = icons || dE > 20;
  const nodes: MapNode[] = [
    { id: "tokens", label: "Colour tokens", sub: `${fg} on ${bg}`, at: [14, 22], mobileAt: [25, 12], state: textOk ? "good" : "bad" },
    { id: "ui", label: "Inputs and icons", sub: `border ${borderRatio.toFixed(2)}:1`, at: [50, 22], mobileAt: [75, 12], state: borderRatio >= 3 ? "good" : "bad" },
    { id: "status", label: "Status badges", sub: icons ? "colour + icon + text" : "colour only", at: [86, 22], mobileAt: [75, 45], state: statusOk ? "good" : "bad" },
    { id: "eyes", label: "The reader's eyes", sub: CVDS.find((c) => c.id === cvd)!.label, at: [86, 78], mobileAt: [75, 80], state: "active" },
    { id: "os", label: "OS setting", sub: osReduce ? "reduce motion: on" : "reduce motion: off", at: [50, 78], mobileAt: [25, 80], state: reduce ? "good" : "idle" },
    { id: "motion", label: "Carousel and animation", sub: autoAdvance ? "moving" : reduce ? "still" : "paused", at: [14, 78], mobileAt: [25, 45], state: autoAdvance && !pausable ? "bad" : "good" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("t", ["tokens", "eyes"], { label: `${ratio.toFixed(2)}:1`, tone: textOk ? "good" : "bad" })
    : stage === 1 ? hops("u", ["ui", "eyes"], { label: `${borderRatio.toFixed(2)}:1`, tone: borderRatio >= 3 ? "good" : "bad" })
    : stage === 2 ? hops("s", ["status", "eyes"], { label: icons ? "✕ / ✓" : `ΔE ${dE.toFixed(0)}`, tone: statusOk ? "good" : "bad" })
    : stage === 3 ? hops("m", ["os", "motion"], { label: reduce ? "reduce" : "no preference", tone: reduce ? "good" : "accent" })
    : stage === 4 ? hops("p", ["motion", "eyes"], { label: autoAdvance ? (pausable ? "pausable" : "can't stop it") : "stopped", tone: autoAdvance && !pausable ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: ${fg} on ${bg} is ${ratio.toFixed(2)}:1. Body text needs 4.5:1 (AA); this ${textOk ? "passes" : "fails"}.`,
    `Step 2: the input's border is ${borderRatio.toFixed(2)}:1 against white; parts people need to see to use a control need 3:1.`,
    statusOk ? `Step 3: ${icons ? "an icon and a word say which is which, whatever colours a reader sees" : `the two colours stay apart for ${CVDS.find((c) => c.id === cvd)!.label} vision (ΔE ${dE.toFixed(0)})`}.` : `Step 3: with ${CVDS.find((c) => c.id === cvd)!.label.toLowerCase()}, the red and green badges are only ΔE ${dE.toFixed(0)} apart: hard to tell which is the error.`,
    osReduce ? "Step 4: your system asks for reduced motion, and the page listens: no sliding, no auto-advance." : simulateReduce ? "Step 4: simulating reduced motion: the page swaps movement for a fade and stops auto-advancing." : "Step 4: your system doesn't ask for reduced motion, so the page animates. Turn on the simulation to see the alternative.",
    autoAdvance ? (pausable ? "Step 5: the carousel moves, but there's a pause button: it can be stopped." : "Step 5: the carousel moves every 3 s with no way to stop it, which fails WCAG's pause, stop, hide rule.") : "Step 5: nothing moves on its own.",
  ];
  const caption = stage !== null ? captions[stage] : `Text ${ratio.toFixed(2)}:1 · border ${borderRatio.toFixed(2)}:1 · status ${statusOk ? "readable" : "colour only"} · motion ${reduce ? "reduced" : "full"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="Contrast and motion"
        blurb="Pale grey text, red and green that only differ in hue, and things that slide on their own all shut people out. WCAG gives exact numbers for contrast and clear rules for motion. The ratios here are computed with WCAG's formula, colour blindness is simulated, and the motion setting is your system's real one."
      />
      <style>{`@keyframes cm-slide { from { transform: translateX(-30%); } to { transform: translateX(30%); } } @keyframes cm-fade { from { opacity: 0.35; } to { opacity: 1; } }`}</style>

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Colour tokens, input borders and status badges reach the reader's eyes; the operating system's reduced-motion setting controls the page's animation"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "tokens", to: "eyes", label: "text" },
                  { from: "ui", to: "eyes", label: "borders" },
                  { from: "status", to: "eyes", label: "colour" },
                  { from: "os", to: "motion", label: "media query" },
                  { from: "motion", to: "eyes", label: "movement" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="A sample of the page with these settings">
                <div className="rounded-md p-3" style={{ background: bg }}>
                  <p className="text-sm" style={{ color: fg }}>
                    Free returns within 30 days. Sizes run small: order half a size up.
                  </p>
                  <input aria-label="Sample input" placeholder="Email" className="mt-2 h-11 w-full max-w-xs rounded-md bg-white px-2 text-sm text-black" style={{ border: `2px solid ${border}` }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { c: ERROR, sim: errSim, icon: "✕", text: "Payment failed" },
                    { c: OK, sim: okSim, icon: "✓", text: "Order shipped" },
                  ].map((b) => (
                    <span key={b.text} className="rounded-full px-3 py-1 text-xs font-medium text-white" style={{ background: rgbToHex(b.sim) }}>
                      {icons ? `${b.icon} ${b.text}` : "●"}
                    </span>
                  ))}
                  <span className="self-center text-[11px] text-[var(--faint)]">as seen with {CVDS.find((c) => c.id === cvd)!.label.toLowerCase()} vision</span>
                </div>
                <div className="relative mt-3 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--inset)] p-3" aria-live="off">
                  <p key={slide} className="text-sm font-medium" style={{ animation: reduce ? "cm-fade 0.4s ease-out" : "cm-slide 0.6s ease-out alternate 2" }}>
                    {SLIDES[slide]}
                  </p>
                  {pausable && !reduce && (
                    <button type="button" onClick={() => setPaused((x) => !x)} className="mt-2 min-h-11 rounded-md border border-[var(--line)] px-3 text-xs">
                      {paused ? "Play" : "Pause"} the carousel
                    </button>
                  )}
                </div>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Simulated vision" accent={ACCENT} value={cvd} onChange={setCvd} options={CVDS.map((c) => ({ id: c.id, label: c.label }))} />
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Checking…">
                Check the page
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Text against its background" what="Contrast is (L1 + 0.05) / (L2 + 0.05), where L is the relative luminance of the lighter and darker colour. Body text needs 4.5:1 for AA and 7:1 for AAA; large text needs 3:1." accent={ACCENT} active={at(0)}>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex min-h-11 items-center gap-2">
                    Text <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="h-9 w-12" />
                  </label>
                  <label className="flex min-h-11 items-center gap-2">
                    Background <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-9 w-12" />
                  </label>
                  {fix && rgbToHex(fix) !== fg && (
                    <button type="button" onClick={() => setFg(rgbToHex(fix))} className="min-h-11 rounded-md border border-[var(--line)] px-3">
                      Nearest passing: {rgbToHex(fix)}
                    </button>
                  )}
                </div>
                <ul className="mt-2 grid gap-x-3 text-xs sm:grid-cols-2">
                  {LEVELS.filter((l) => l.id !== "non-text").map((l) => (
                    <li key={l.id} style={{ color: ratio >= l.min ? "var(--good)" : "var(--bad)" }}>
                      {ratio >= l.min ? "✓" : "✕"} {l.label} ({l.min}:1)
                    </li>
                  ))}
                </ul>
                <p className="mt-1 font-mono text-sm">{ratio.toFixed(2)}:1</p>
              </FlowStep>
              <FlowArrow label="controls" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Borders and icons need 3:1 too" what="The edge of an input, a checkbox outline, an icon-only button: anything someone must see to use a control needs 3:1 against what's next to it. Very light grey borders are the classic failure." accent={ACCENT} active={at(1)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={darkBorder} onChange={(e) => setDarkBorder(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Darker input border ({BORDER_DARK} instead of {BORDER_LIGHT})
                </label>
                <p className="font-mono text-xs" style={{ color: borderRatio >= 3 ? "var(--good)" : "var(--bad)" }}>
                  border {borderRatio.toFixed(2)}:1 {borderRatio >= 3 ? "passes" : "fails"} 3:1
                </p>
              </FlowStep>
              <FlowArrow label="meaning" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Don't rely on colour alone" what="About 1 in 12 men has some colour vision deficiency, most often red–green. If colour is the only difference between an error and a success, add a second cue: an icon, a word, a pattern." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={icons} onChange={(e) => setIcons(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Add an icon and a word to each badge
                </label>
                <p className="font-mono text-xs text-[var(--muted)]">
                  red vs green as seen: ΔE {dE.toFixed(1)} ({dE < 10 ? "close to the same colour" : dE < 25 ? "similar" : "clearly different"})
                </p>
              </FlowStep>
              <FlowArrow label="motion" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Respect reduced motion" what="People with vestibular disorders can feel sick from sliding and zooming. Operating systems have a reduce-motion setting, and pages can read it with the prefers-reduced-motion media query, then fade instead of sliding, or not animate at all." accent={ACCENT} active={at(3)}>
                <p className="text-xs">
                  Your system right now: <span className="font-mono">{QUERY.replace(/[()]/g, "")}</span> is <strong>{osReduce ? "on" : "off"}</strong>
                </p>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={simulateReduce} onChange={(e) => setSimulateReduce(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Simulate reduced motion
                </label>
              </FlowStep>
              <FlowArrow label="things that move" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Let people pause what moves" what="Anything that moves on its own for more than five seconds needs a way to pause, stop or hide it. That helps people who are distracted by motion, who read slowly, or who use a magnifier and lose their place." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={pausable} onChange={(e) => setPausable(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Give the carousel a pause button
                </label>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Contrast uses WCAG&apos;s relative luminance; colour vision is simulated with Machado et al. (2009) matrices and compared with CIE76 ΔE; reduced motion is read from your system with matchMedia.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
