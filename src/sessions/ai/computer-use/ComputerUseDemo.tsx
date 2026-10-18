"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import {
  INJECTED,
  NEW_ADDRESS,
  OLD_ADDRESS,
  PATCH,
  SCENARIOS,
  SCREEN,
  SCREENSHOT_TOKENS,
  SPOTS,
  TASK,
  actionText,
  contextTokens,
  frames,
  type Frame,
  type ScenarioId,
  type Screen,
} from "@/lib/computerUse";

const ACCENT = "var(--ai)";
const OUTCOME: Record<Frame["outcome"], { label: string; color: string }> = {
  ok: { label: "worked", color: "var(--good)" },
  miss: { label: "missed", color: "var(--bad)" },
  done: { label: "finished", color: "var(--good)" },
  bad: { label: "harmful", color: "var(--bad)" },
  held: { label: "held for approval", color: "var(--c3)" },
};

export default function ComputerUseDemo() {
  const [scenario, setScenario] = useState<ScenarioId>("clean");
  const [confirm, setConfirm] = useState(false);
  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Computer-use and browser agents"
        blurb="A computer-use agent sees the screen only as screenshots and acts only through clicks and keystrokes. Your harness runs the loop: screenshot, model, one action, run it, screenshot again. Watch it change an order's address, get blocked by a cookie banner, and meet instructions hidden on the page."
      />
      <div className="mt-6">
        <Agent key={`${scenario}-${confirm}`} scenario={scenario} setScenario={setScenario} confirm={confirm} setConfirm={setConfirm} />
      </div>
    </SessionPage>
  );
}

function Agent({ scenario, setScenario, confirm, setConfirm }: { scenario: ScenarioId; setScenario: (s: ScenarioId) => void; confirm: boolean; setConfirm: (v: boolean) => void }) {
  const list = frames(scenario, confirm);
  const playback = usePlayback(list.length, 2200);
  const i = playback.i;
  const f = list[i];
  const actions = list.slice(0, i + 1).filter((x) => x.act).length;

  // Nothing moves until the reader starts the run, as in the other system maps.
  const started = i > 0 || playback.playing;
  const packets: Packet[] = !started
    ? []
    : f.outcome === "held"
      ? hops(`held-${i}`, ["browser", "harness", "model", "harness", "user"], { label: "approve?", step: 0.4 })
      : f.act
        ? hops(`f-${i}`, ["browser", "harness", "model", "harness", "browser"], { label: f.act.action === "type" ? "type" : "click", tone: f.outcome === "bad" ? "bad" : "accent", step: 0.4 })
        : hops(`end-${i}`, ["harness", "user"], { label: "done", tone: "good" });

  const step5 = f.outcome !== "ok";

  return (
    <SessionLayout
      visual={
        <div className="space-y-4">
          <SystemMap
            title="The harness takes a screenshot of the browser, sends it to the model, and runs the action the model returns"
            accent={ACCENT}
            chrome="split"
            nodes={[
              { id: "user", label: "You", sub: f.outcome === "held" ? "approve?" : "gave the task", at: [12, 50], mobileAt: [22, 14], state: f.outcome === "held" ? "wait" : f.act ? "idle" : "good" },
              { id: "harness", label: "Agent harness", sub: `action ${actions}`, at: [40, 50], mobileAt: [72, 14], state: "active" },
              { id: "model", label: "Model", sub: `${(contextTokens(i) / 1000).toFixed(1)}k tokens`, at: [72, 18], mobileAt: [22, 82], state: f.act ? "active" : "idle" },
              { id: "browser", label: "Browser (VM)", sub: f.screen.page, at: [72, 82], mobileAt: [72, 82], state: f.outcome === "bad" ? "bad" : f.outcome === "miss" ? "wait" : "active" },
            ]}
            links={[
              { from: "user", to: "harness", label: "task" },
              { from: "harness", to: "model", label: "screenshot" },
              { from: "harness", to: "browser", label: "action" },
            ]}
            packets={packets}
            aspect={2.2}
            mobileAspect={1.15}
          />
          <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 sm:p-4" aria-label="The screenshot the model sees this turn">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]">
              screenshot {i + 1} · {SCREEN.w}×{SCREEN.h}
            </p>
            <ScreenShot screen={f.screen} click={f.act && f.act.action !== "type" ? f.act.coordinate : null} />
          </section>
        </div>
      }
      panel={
        <SystemMapPanel caption={`${f.thought} → ${f.note}`}>
          <div className="w-full">
            <Choices label="Scenario" accent={ACCENT} value={scenario} onChange={setScenario} options={SCENARIOS} />
          </div>
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next action" status={`turn ${i + 1} of ${list.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Take a screenshot" what="The model can't read the page's HTML here; it gets pixels, like you. Each screenshot costs about a thousand tokens." accent={ACCENT} active={false}>
            <p className="font-mono text-sm">
              ⌈{SCREEN.w} ÷ {PATCH}⌉ × ⌈{SCREEN.h} ÷ {PATCH}⌉ = {SCREENSHOT_TOKENS.toLocaleString("en-US")} tokens
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {i + 1} {i === 0 ? "screenshot" : "screenshots"} in the context so far: {contextTokens(i).toLocaleString("en-US")} tokens. Harnesses drop old ones to keep this down.
            </p>
          </FlowStep>
          <FlowArrow label="image + task" accent={ACCENT} />

          <FlowStep n={2} title="Send it to the model with the task" what="The model looks at the screenshot, compares it with the goal and the previous turns, and decides the one next move." accent={ACCENT} active={false}>
            <p className="text-xs text-[var(--faint)]">Task: {TASK}</p>
            <p className="mt-1 text-sm italic">{f.thought}</p>
          </FlowStep>
          <FlowArrow label="one action" accent={ACCENT} />

          <FlowStep n={3} title="Get one action back" what="A tool call with an action and pixel coordinates, or text to type. The model has to locate the button in the image itself." accent={ACCENT} active={!step5}>
            <p className="break-words rounded-md bg-[var(--inset)] px-2 py-1.5 font-mono text-xs">{actionText(f.act)}</p>
          </FlowStep>
          <FlowArrow label="click / type" accent={ACCENT} />

          <FlowStep n={4} title="Run it in the browser" what="Your harness performs the action in a sandboxed browser or VM. This is where you put limits: which sites, which actions, and which need a person to approve." accent={ACCENT} active={f.outcome === "held"}>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
              Ask me before changing account settings
            </label>
            <p className="text-xs text-[var(--muted)]">{scenario === "inject" ? "Matters in this scenario: watch the last turns." : "Try it with “Text aimed at the agent”."}</p>
          </FlowStep>
          <FlowArrow label="new screenshot, back to step 1" accent={ACCENT} />

          <FlowStep n={5} title="Look again, and check" what="The only way to know the click worked is the next screenshot. A wasted click shows up as a screen that didn't change. Then the loop repeats until the model says it's done." accent={ACCENT} active={step5}>
            <p className="text-sm">
              <span className="font-mono" style={{ color: OUTCOME[f.outcome].color }}>
                {OUTCOME[f.outcome].label}
              </span>{" "}
              · {f.note}
            </p>
            {scenario === "inject" && (
              <p className="mt-2 text-xs text-[var(--muted)]">
                The page text said: <span className="italic">{INJECTED}</span> Anything on screen reaches the model, so a web page can try to give it orders. Only you can approve account changes.
              </p>
            )}
          </FlowStep>
        </>
      }
    />
  );
}

// The mock page, drawn on the same 1024 × 768 grid the model's clicks use.
function ScreenShot({ screen, click }: { screen: Screen; click: [number, number] | null }) {
  const at = ([x, y]: [number, number]) => ({ left: `${(x / SCREEN.w) * 100}%`, top: `${(y / SCREEN.h) * 100}%` });
  const btn = "absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded border px-[2.5%] py-[1%] text-[clamp(8px,1.6vw,12px)]";
  const text = "text-[clamp(8px,1.6vw,12px)]";

  return (
    <div className="relative w-full overflow-hidden rounded-md border border-[var(--line)] bg-[var(--bg)]" style={{ aspectRatio: `${SCREEN.w} / ${SCREEN.h}` }}>
      <div className="absolute inset-x-0 top-0 flex h-[10%] items-center border-b border-[var(--line)] px-[3%]">
        <span className={`${text} font-semibold`}>Acme Shop</span>
      </div>
      <span className={`absolute -translate-x-1/2 -translate-y-1/2 ${text} text-[var(--muted)]`} style={at(SPOTS.account)}>
        Account
      </span>

      {screen.page === "order" && (
        <>
          <p className={`absolute left-[6%] top-[16%] font-semibold ${text}`}>Order #4471 · 1 desk lamp</p>
          <p className={`absolute left-[6%] top-[36%] ${text} text-[var(--muted)]`}>Ship to: {OLD_ADDRESS}</p>
          <span className={btn} style={{ ...at(SPOTS.edit), borderColor: "var(--line-strong)" }}>
            Edit address
          </span>
        </>
      )}

      {screen.page === "form" && (
        <>
          <p className={`absolute left-[6%] top-[16%] font-semibold ${text}`}>Edit shipping address</p>
          <span className={`absolute -translate-x-1/2 -translate-y-1/2 w-[44%] rounded border px-[1.5%] py-[1%] ${text}`} style={{ ...at(SPOTS.field), borderColor: ACCENT }}>
            <span style={screen.selected ? { background: `color-mix(in srgb, ${ACCENT} 35%, transparent)` } : undefined}>{screen.field}</span>
          </span>
          <span className={btn} style={{ ...at(SPOTS.save), background: ACCENT, color: "var(--on-accent)", borderColor: ACCENT }}>
            Save
          </span>
        </>
      )}

      {screen.page === "saved" && (
        <>
          <p className={`absolute left-[6%] top-[16%] font-semibold ${text}`} style={{ color: "var(--good)" }}>
            ✓ Address updated
          </p>
          <p className={`absolute left-[6%] top-[30%] ${text}`}>Ship to: {NEW_ADDRESS}</p>
          {screen.injected && <p className="absolute inset-x-[6%] bottom-[4%] text-[clamp(6px,1.1vw,9px)] text-[var(--faint)]">{INJECTED}</p>}
        </>
      )}

      {screen.page === "account" && (
        <>
          <p className={`absolute left-[6%] top-[16%] font-semibold ${text}`}>Account settings</p>
          <span className={`absolute -translate-x-1/2 -translate-y-1/2 w-[44%] rounded border px-[1.5%] py-[1%] ${text}`} style={{ ...at(SPOTS.email), borderColor: "var(--line-strong)" }}>
            <span style={screen.selected ? { background: `color-mix(in srgb, ${ACCENT} 35%, transparent)` } : undefined}>{screen.field}</span>
          </span>
          <span className={btn} style={{ ...at(SPOTS.saveEmail), borderColor: "var(--line-strong)" }}>
            Save email
          </span>
        </>
      )}

      {screen.banner && (
        <>
          <div className="absolute left-[11%] right-[11%] top-[26%] bottom-[27%] rounded-md border border-[var(--line-strong)] bg-[var(--panel)] p-[3%] shadow-lg">
            <p className={`${text} font-semibold`}>We value your privacy</p>
            <p className={`${text} text-[var(--muted)]`}>We use cookies to improve your experience.</p>
          </div>
          <span className={`${btn} bg-[var(--panel)]`} style={{ ...at(SPOTS.reject), borderColor: "var(--line-strong)" }}>
            Reject all
          </span>
        </>
      )}

      {screen.dialog && (
        <div className="absolute inset-0 grid place-items-center" style={{ background: "color-mix(in srgb, var(--bg) 60%, transparent)" }}>
          <div className="w-[60%] rounded-md border border-[var(--c3)] bg-[var(--panel)] p-[3%]">
            <p className={`${text} font-semibold`}>Approve this action?</p>
            <p className={`${text} text-[var(--muted)]`}>The agent wants to change your account email.</p>
            <p className={`${text} mt-1`} style={{ color: "var(--bad)" }}>
              You said: no
            </p>
          </div>
        </div>
      )}

      {click && (
        <span className="pointer-events-none absolute h-[5%] w-[3.75%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ ...at(click), borderColor: "var(--bad)", background: "color-mix(in srgb, var(--bad) 25%, transparent)" }} aria-hidden />
      )}
    </div>
  );
}
