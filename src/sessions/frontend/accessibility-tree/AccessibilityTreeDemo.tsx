"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { PARTS, SEMANTIC, SOUP, exposed, flatten, screenReader, tree, type Fixed } from "@/lib/a11yTree";

const ACCENT = "var(--web)";

export default function AccessibilityTreeDemo() {
  const [f, setF] = useState<Fixed>(SOUP);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const sr = screenReader(f);
  const rows = flatten(exposed(tree(f))[0]);
  const fixedCount = PARTS.filter((p) => f[p.id]).length;

  const nodes: MapNode[] = [
    { id: "html", label: "Your HTML", sub: `${fixedCount} of ${PARTS.length} parts semantic`, at: [14, 22], mobileAt: [25, 12], state: fixedCount === PARTS.length ? "good" : "wait" },
    { id: "dom", label: "DOM", sub: "every element", at: [50, 22], mobileAt: [75, 12], state: "active" },
    { id: "ax", label: "Accessibility tree", sub: `${rows.length - 1} nodes · ${sr.issues.length} problems`, at: [86, 22], mobileAt: [75, 45], state: sr.issues.length ? "bad" : "good" },
    { id: "sr", label: "Screen reader", sub: `${sr.headings.length} headings · ${sr.landmarks.length} landmarks`, at: [86, 78], mobileAt: [75, 80], state: sr.headings.length && sr.landmarks.length ? "good" : "bad" },
    { id: "kbd", label: "Keyboard", sub: `${sr.tabStops.length} Tab stops`, at: [50, 78], mobileAt: [25, 80], state: f.button && f.nav ? "good" : "bad" },
    { id: "voice", label: "Voice control", sub: f.icon ? "every button has a name" : "an unnamed button", at: [14, 78], mobileAt: [25, 45], state: f.icon && f.button ? "good" : "bad" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("p", ["html", "dom"], { label: "parse" })
    : stage === 1 ? hops("r", ["dom", "ax"], { label: "roles" })
    : stage === 2 ? hops("n", ["dom", "ax"], { label: "names", tone: sr.issues.some((i) => i.includes("alt") || i.includes("name") || i.includes("placeholder")) ? "bad" : "good" })
    : stage === 3 ? hops("s", ["ax", "sr"], { label: `${sr.headings.length} h · ${sr.landmarks.length} landmarks`, tone: sr.headings.length ? "good" : "bad" })
    : stage === 4 ? hops("k", ["ax", "kbd"], { label: `${sr.tabStops.length} stops`, tone: f.button ? "good" : "bad" })
    : [];

  const captions = [
    "Step 1: the HTML is parsed into the DOM, with every div, span and button in it.",
    "Step 2: the browser builds an accessibility tree beside the DOM: each element gets a role from its tag, and plain containers drop out.",
    `Step 3: each node gets a name from its label, alt, aria-label or text. ${sr.issues.length ? `${sr.issues.length} problem${sr.issues.length === 1 ? "" : "s"} in roles and names.` : "Every node has the right role and a useful name."}`,
    sr.headings.length || sr.landmarks.length ? `Step 4: a screen reader user can jump between ${sr.headings.length} heading${sr.headings.length === 1 ? "" : "s"} and ${sr.landmarks.length} landmark${sr.landmarks.length === 1 ? "" : "s"}.` : "Step 4: no headings and no landmarks: the only way through the page is reading it all, top to bottom.",
    `Step 5: Tab reaches ${sr.tabStops.length} thing${sr.tabStops.length === 1 ? "" : "s"}${f.button ? "" : "; Add to cart isn't one of them"}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${sr.issues.length} problem${sr.issues.length === 1 ? "" : "s"} · ${sr.headings.length} headings · ${sr.landmarks.length} landmarks · ${sr.tabStops.length} Tab stops.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="Semantic HTML and the accessibility tree"
        blurb="Screen readers, voice control and switch devices don't see your pixels. They see the accessibility tree: a role, a name and a state for each thing on the page, built from your HTML. Two pages that look the same can produce very different trees. Swap each part from divs to real elements and hear the difference."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Your HTML becomes the DOM, the browser derives the accessibility tree from it, and screen readers, keyboards and voice control all read that tree"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "html", to: "dom", label: "parse" },
                  { from: "dom", to: "ax", label: "roles, names" },
                  { from: "ax", to: "sr", label: "accessibility API" },
                  { from: "ax", to: "kbd", label: "focus order" },
                  { from: "ax", to: "voice", label: "names" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The accessibility tree">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">accessibility tree · role, &quot;name&quot;</p>
                <ul className="mt-2 space-y-0.5 font-mono text-[11px]">
                  {rows.map(({ node, depth }, i) => (
                    <li key={i} style={{ paddingLeft: depth * 12, color: node.issue ? "var(--bad)" : node.role === "text" ? "var(--muted)" : "var(--text)" }}>
                      {node.role}
                      {node.level ? ` (level ${node.level})` : ""}
                      {node.name ? ` "${node.name}"` : node.role === "button" ? " (no name)" : ""}
                      {node.nameFrom && node.name && node.role !== "text" && <span className="text-[10px] text-[var(--faint)]"> · from {node.nameFrom}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setF(SOUP)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Div soup
                </button>
                <button type="button" onClick={() => setF(SEMANTIC)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Semantic HTML
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Reading…">
                Read the page
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Write the page" what="Each part below can be written with generic elements styled to look right, or with the element that means what it is. Tick a part to switch it to semantic HTML." accent={ACCENT} active={at(0)}>
                <ul className="space-y-1.5">
                  {PARTS.map((p) => (
                    <li key={p.id}>
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <input type="checkbox" checked={f[p.id]} onChange={(e) => setF((c) => ({ ...c, [p.id]: e.target.checked }))} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                        {p.label}
                      </label>
                      <code className="block break-all rounded bg-[var(--inset)] px-2 py-1 font-mono text-[10px] text-[var(--muted)]">{f[p.id] ? p.semantic : p.soup}</code>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="the DOM" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Roles come from elements" what="<button> is a button, <a href> a link, <h1> a heading, <nav> and <main> landmarks. A <div> is generic: it adds nothing, whatever it looks like or whatever its click handler does." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs text-[var(--muted)]">roles: {[...new Set(rows.map((r) => r.node.role))].filter((r) => r !== "document").join(", ")}</p>
              </FlowStep>
              <FlowArrow label="names" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Names come from labels, alt and content" what="The accessible name is computed in order: aria-labelledby, aria-label, the element's own label or alt, its text, and only then title or placeholder. An image with no alt gets its file name read out; an icon button with no label is just 'button'." accent={ACCENT} active={at(2)}>
                {sr.issues.length === 0 ? (
                  <p className="text-sm text-[var(--good)]">Every role and name is right.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {sr.issues.map((issue, i) => (
                      <li key={i} className="rounded-md border-l-2 bg-[var(--inset)] px-2 py-1" style={{ borderColor: "var(--bad)" }}>
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}
              </FlowStep>
              <FlowArrow label="structure" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Headings and landmarks let people skip" what="Screen reader users rarely read a page top to bottom. They pull up a list of headings, landmarks or links and jump. Without them, the page is one long paragraph." accent={ACCENT} active={at(3)}>
                <dl className="grid gap-2 text-xs sm:grid-cols-3">
                  {[
                    ["Headings", sr.headings],
                    ["Landmarks", sr.landmarks],
                    ["Links", sr.links],
                  ].map(([k, v]) => (
                    <div key={k as string} className="rounded-md bg-[var(--inset)] p-2">
                      <dt className="text-[10px] text-[var(--faint)]">{k as string}</dt>
                      <dd className="font-mono" style={{ color: (v as string[]).length ? undefined : "var(--bad)" }}>
                        {(v as string[]).length ? (v as string[]).join(" · ") : "none"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </FlowStep>
              <FlowArrow label="out loud" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Hear it, and Tab through it" what="Reading the whole page out shows what a screen reader says for each node. Tab moves only between focusable things: links, buttons and form fields, never a div with a click handler." accent={ACCENT} active={at(4)}>
                <ol className="space-y-0.5 font-mono text-[11px]">
                  {sr.readout.map((line, i) => (
                    <li key={i}>“{line}”</li>
                  ))}
                </ol>
                <p className="mt-2 text-xs text-[var(--muted)]">Tab order: {sr.tabStops.join(" → ") || "nothing"}</p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Roles follow HTML-AAM and names the accessible name computation; the spoken phrasing is a simplified version of what screen readers say.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
