"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { BRAND, CHANGES, CURRENT, NEW_BRAND, PRIMITIVES, codebase, drift, rebrand, release, semantic, themeChecks, type Change, type Style, type Theme } from "@/lib/designSystem";

const ACCENT = "var(--web)";

export default function DesignSystemsDemo() {
  const [style, setStyle] = useState<Style>("hardcoded");
  const [theme, setTheme] = useState<Theme>("dark");
  const [darkFix, setDarkFix] = useState(false);
  const [change, setChange] = useState<Change>("fix");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const rb = rebrand(style);
  const dr = drift(style);
  const checks = themeChecks(theme, darkFix);
  const failing = checks.filter((c) => !c.ok).length;
  const rel = release(change);
  const gets = rel.apps.filter((a) => a.gets).length;
  const sem = semantic(theme, darkFix);
  const tok = (name: string) => PRIMITIVES[sem[name]];

  const preset = (good: boolean) => {
    setStyle(good ? "tokens" : "hardcoded");
    setDarkFix(good);
  };

  const nodes: MapNode[] = [
    { id: "prim", label: "Primitive tokens", sub: "blue-600, gray-900…", at: [14, 22], mobileAt: [25, 12], state: "active" },
    { id: "sem", label: "Semantic tokens", sub: style === "tokens" ? "color-action-bg…" : "not used", at: [50, 22], mobileAt: [75, 12], state: style === "tokens" ? "good" : "dim" },
    { id: "comp", label: "Components", sub: style === "tokens" ? "read tokens" : `${dr.paddings} paddings, ${dr.radii} radii`, at: [86, 22], mobileAt: [75, 45], state: style === "tokens" ? "good" : "bad" },
    { id: "theme", label: `${theme === "dark" ? "Dark" : "Light"} theme`, sub: failing ? `${failing} contrast failure${failing === 1 ? "" : "s"}` : "all pairs pass", at: [14, 78], mobileAt: [25, 45], state: failing ? "bad" : "good" },
    { id: "pkg", label: "@shop/ui package", sub: `${CURRENT} → ${rel.next}`, at: [50, 78], mobileAt: [25, 80], state: "active" },
    { id: "apps", label: "Product apps", sub: `${gets} of ${rel.apps.length} get it`, at: [86, 78], mobileAt: [75, 80], state: gets === rel.apps.length ? "good" : "wait" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("p", ["prim", "sem"], { label: "palette" })
    : stage === 1 ? (style === "tokens" ? hops("r", ["prim", "sem", "comp"], { label: "1 edit", tone: "good" }) : hops("r", ["prim", "comp"], { label: `${rb.missed.length} missed`, tone: "bad" }))
    : stage === 2 ? hops("t", ["sem", "theme"], { label: failing ? `${failing} fail` : "contrast ok", tone: failing ? "bad" : "good" })
    : stage === 3 ? hops("c", ["comp", "pkg"], { label: "Button, Badge…" })
    : stage === 4 ? hops("a", ["pkg", "apps"], { label: rel.next, tone: gets === rel.apps.length ? "good" : "bad" })
    : [];

  const captions = [
    "Step 1: primitive tokens name the raw values: the palette, the spacing scale, the radii.",
    style === "tokens" ? `Step 2: rebranding from ${BRAND} to ${NEW_BRAND} is one edit in tokens.json; every component follows.` : `Step 2: rebranding by search and replace changes ${rb.edits} files, and ${rb.missed.length} stay blue: ${rb.missed.join(", ")}.`,
    `Step 3: the ${theme} theme maps the same semantic tokens to different values; ${failing ? `${failing} pair${failing === 1 ? "" : "s"} fail contrast` : "every pair passes contrast"}.`,
    "Step 4: components read semantic tokens and bake in the decisions: sizes, focus rings, disabled states.",
    `Step 5: "${CHANGES.find((c) => c.id === change)!.label}" ships as ${rel.next}; ${gets} of ${rel.apps.length} apps pick it up on their next install.`,
  ];
  const caption = stage !== null ? captions[stage] : `Rebrand: ${style === "tokens" ? "1 edit" : `${rb.edits} edits, ${rb.missed.length} missed`} · ${theme} theme: ${failing} contrast failure${failing === 1 ? "" : "s"} · ${rel.next} reaches ${gets} of ${rel.apps.length} apps.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="Design systems"
        blurb="A design system is shared decisions: named colours, spacing and type as tokens, components built on them, published as a versioned package that every product uses. Without one, the same blue is typed fifty times in five slightly different ways. Rebrand a shop, add a dark theme and ship a fix to four apps."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Primitive tokens feed semantic tokens, which feed components and themes; components ship as a versioned package to product apps"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "prim", to: "sem", label: "named by purpose" },
                  { from: "sem", to: "comp", label: "var(--…)", dim: style !== "tokens" },
                  { from: "prim", to: "comp", label: "copied hex", dim: style === "tokens" },
                  { from: "sem", to: "theme", label: "light / dark" },
                  { from: "comp", to: "pkg", label: "publish" },
                  { from: "pkg", to: "apps", label: "npm install" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The codebase's styles and a preview of the theme">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{style === "tokens" ? "components using tokens" : "components with copied values"}</p>
                <ul className="mt-2 space-y-0.5 font-mono text-[10px]">
                  {codebase(style).map((f) => (
                    <li key={f.file} className="break-all" style={{ color: rb.missed.includes(f.file) ? "var(--bad)" : "var(--muted)" }}>
                      <span className="text-[var(--text)]">{f.file}</span> {f.css}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 rounded-md p-3" style={{ background: tok("color-surface") }}>
                  <p className="text-sm" style={{ color: tok("color-text") }}>
                    Trail runner 2
                  </p>
                  <p className="text-xs" style={{ color: tok("color-muted") }}>
                    Free returns within 30 days
                  </p>
                  <span className="mt-2 inline-block rounded-md px-3 py-2 text-sm font-medium" style={{ background: tok("color-action-bg"), color: tok("color-action-text") }}>
                    Add to cart
                  </span>
                </div>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => preset(false)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Values copied everywhere
                </button>
                <button type="button" onClick={() => preset(true)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  A design system
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Shipping…">
                Rebrand and ship
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Name the raw values" what="Primitive tokens give every colour, space and radius in the palette a name. Nothing in a component should be a raw hex code or a random 13px." accent={ACCENT} active={at(0)}>
                <ul className="flex flex-wrap gap-2">
                  {Object.entries(PRIMITIVES).map(([name, hex]) => (
                    <li key={name} className="flex items-center gap-1.5 text-[11px]">
                      <span className="inline-block h-5 w-5 rounded border border-[var(--line)]" style={{ background: hex }} />
                      <span className="font-mono">{name}</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="purpose" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Name them by purpose, and use the names" what="Semantic tokens say what a value is for: color-action-bg, not blue-600. Components that use them change together; components with copied values change one search-and-replace at a time, and the near-duplicates get missed." accent={ACCENT} active={at(1)}>
                <Choices<Style> accent={ACCENT} value={style} onChange={setStyle} options={[{ id: "hardcoded", label: "Copied values" }, { id: "tokens", label: "Semantic tokens" }]} />
                <p className="mt-2 text-xs" style={{ color: rb.missed.length ? "var(--bad)" : "var(--good)" }}>
                  Rebrand to {NEW_BRAND}: {rb.note}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  Button-like paddings in use: {dr.paddings} · corner radii: {dr.radii}
                </p>
              </FlowStep>
              <FlowArrow label="themes" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Theme by swapping values" what="A dark theme maps the same semantic tokens to different primitives. A first attempt usually just flips the background; contrast has to be checked again, pair by pair." accent={ACCENT} active={at(2)}>
                <Choices<Theme> accent={ACCENT} value={theme} onChange={setTheme} options={[{ id: "light", label: "Light" }, { id: "dark", label: "Dark" }]} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={darkFix} onChange={(e) => setDarkFix(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Tune the dark theme (lighter blue, lighter grey)
                </label>
                <ul className="space-y-0.5 text-xs">
                  {checks.map((c) => (
                    <li key={c.label} style={{ color: c.ok ? "var(--muted)" : "var(--bad)" }}>
                      {c.ok ? "✓" : "✕"} {c.label}: <span className="font-mono">{c.fg} on {c.bg} = {c.ratio.toFixed(2)}:1</span> (needs {c.min}:1)
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="components" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Build components on the tokens" what="A shared Button decides once what a button is: its sizes, variants, focus ring, disabled and loading states, and its accessibility. Product teams compose it instead of restyling a <div> again." accent={ACCENT} active={at(3)}>
                <pre className="overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">{`<Button variant="primary" size="md" loading={saving}>\n  Add to cart\n</Button>`}</pre>
              </FlowStep>
              <FlowArrow label="a release" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Version it and ship it" what="Components ship as a package with semantic versions: a fix is a patch, a new option a minor, a breaking change a major. Each app's version range decides what it picks up, so a fix reaches only the apps whose range allows it." accent={ACCENT} active={at(4)}>
                <Choices<Change> accent={ACCENT} value={change} onChange={setChange} options={CHANGES.map((c) => ({ id: c.id, label: c.label }))} />
                <p className="mt-2 font-mono text-xs">
                  {CURRENT} → {rel.next}
                </p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {rel.apps.map((a) => (
                    <li key={a.name} style={{ color: a.gets ? "var(--good)" : "var(--bad)" }}>
                      {a.name} <span className="font-mono text-[var(--muted)]">{a.range}</span>: {a.gets ? "gets it" : "stays behind"}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The rebrand is a real search over the component styles; contrast uses WCAG&apos;s formula; version ranges use npm&apos;s caret, tilde and exact rules.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
