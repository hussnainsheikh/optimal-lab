"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { TAG, defineRating } from "@/lib/ratingElement";

const ACCENT = "var(--web)";
const PAGE_RED = "rgb(220, 38, 38)";
const THEME_BLUE = "rgb(37, 99, 235)";

type Cfg = { shadow: boolean; theme: boolean; composed: boolean; formValue: boolean };
const PLAIN: Cfg = { shadow: false, theme: false, composed: false, formValue: false };
const FULL: Cfg = { shadow: true, theme: true, composed: true, formValue: true };

type Probe = { pageCssInside: boolean; starsFromDocument: number; partStyled: boolean; customProp: boolean; form: string; heardHost: boolean | null; heardDocument: boolean | null };

export default function WebComponentsDemo() {
  const [cfg, setCfgRaw] = useState<Cfg>(PLAIN);
  const [log, setLog] = useState<string[]>([]);
  const [probe, setProbe] = useState<Probe | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const heard = useRef({ host: false, doc: false });
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const setCfg = (p: Partial<Cfg>) => {
    setLog([]);
    setCfgRaw((c) => ({ ...c, ...p }));
  };

  const measure = useCallback((clicked: boolean): Probe | null => {
    const el = box.current?.querySelector(TAG) as (HTMLElement & { shadowRoot: ShadowRoot | null }) | null;
    if (!el || !form.current) return null;
    const scope = el.shadowRoot ?? el;
    const stars = scope.querySelectorAll<HTMLElement>("button.star");
    if (!stars.length) return null;
    const first = getComputedStyle(stars[0]);
    const last = getComputedStyle(stars[stars.length - 1]);
    const data = [...new FormData(form.current).entries()].map(([k, v]) => `${k}=${v}`).join("&");
    return {
      pageCssInside: first.backgroundColor === PAGE_RED,
      starsFromDocument: document.querySelectorAll(`.wc-page ${TAG} button.star`).length,
      partStyled: first.outlineStyle === "dashed",
      customProp: last.color === THEME_BLUE,
      form: data || "(nothing)",
      heardHost: clicked ? heard.current.host : null,
      heardDocument: clicked ? heard.current.doc : null,
    };
  }, []);

  useEffect(() => {
    defineRating();
    const onLog = (e: Event) => setLog((l) => [...l.slice(-7), (e as CustomEvent<string>).detail]);
    const onDoc = () => {
      heard.current.doc = true;
    };
    document.addEventListener("ol-rating-log", onLog);
    document.addEventListener("rating-change", onDoc);
    return () => {
      document.removeEventListener("ol-rating-log", onLog);
      document.removeEventListener("rating-change", onDoc);
    };
  }, []);

  // Build a fresh element whenever the configuration changes (a shadow root can't be removed).
  useEffect(() => {
    const target = box.current;
    if (!target) return;
    target.innerHTML = "";
    const el = document.createElement(TAG);
    el.setAttribute("name", "fit");
    el.setAttribute("value", "3");
    el.setAttribute("shadow", cfg.shadow ? "open" : "none");
    el.setAttribute("composed", String(cfg.composed));
    el.setAttribute("form-value", String(cfg.formValue));
    const label = document.createElement("span");
    label.textContent = "Fit ";
    el.append(label);
    el.addEventListener("rating-change", () => {
      heard.current.host = true;
    });
    target.append(el);
    const id = requestAnimationFrame(() => setProbe(measure(false)));
    return () => cancelAnimationFrame(id);
  }, [cfg, measure]);

  const clickStar = () => {
    const el = box.current?.querySelector(TAG) as HTMLElement | null;
    const star = (el?.shadowRoot ?? el)?.querySelectorAll<HTMLElement>("button.star")[3];
    if (!star) return;
    heard.current = { host: false, doc: false };
    star.click();
    requestAnimationFrame(() => setProbe(measure(true)));
  };

  const p = probe;
  const nodes: MapNode[] = [
    { id: "css", label: "Page CSS", sub: p ? (p.pageCssInside ? "restyles the stars" : "stops at the shadow root") : "…", at: [14, 22], mobileAt: [25, 12], state: p?.pageCssInside ? "bad" : "good" },
    { id: "js", label: "Page script", sub: p?.heardDocument === null || !p ? "listens on document" : p.heardDocument ? "heard rating-change" : "heard nothing", at: [50, 22], mobileAt: [75, 12], state: p?.heardDocument === false ? "wait" : "active" },
    { id: "form", label: "<form>", sub: p ? p.form : "…", at: [86, 22], mobileAt: [75, 45], state: p && p.form !== "(nothing)" ? "good" : "wait" },
    { id: "host", label: `<${TAG}>`, sub: "the custom element", at: [50, 78], mobileAt: [25, 45], state: "active" },
    { id: "shadow", label: cfg.shadow ? "Shadow root" : "Light DOM", sub: "5 star buttons", at: [86, 78], mobileAt: [75, 80], state: cfg.shadow ? "good" : "wait" },
    { id: "slot", label: "Page content", sub: '"Fit" label, slotted', at: [14, 78], mobileAt: [25, 80], state: "idle" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("d", ["js", "host"], { label: "define()" })
    : stage === 1 ? hops("c", ["css", "host", "shadow"], { label: p?.pageCssInside ? "button { red }" : "blocked", tone: p?.pageCssInside ? "bad" : "good" })
    : stage === 2 ? hops("t", ["css", "host", "shadow"], { label: cfg.theme ? "--star-color, ::part" : "no theme", tone: cfg.theme ? "good" : "accent" })
    : stage === 3 ? hops("e", ["shadow", "host", "js"], { label: cfg.composed || !cfg.shadow ? "composed" : "stops at the root", tone: cfg.composed || !cfg.shadow ? "good" : "bad" })
    : stage === 4 ? hops("f", ["host", "form"], { label: cfg.formValue ? "fit=3" : "no value", tone: cfg.formValue ? "good" : "bad" })
    : [];

  const captions = [
    "Step 1: customElements.define registers <ol-rating>; the browser upgrades the element and calls its lifecycle callbacks.",
    p?.pageCssInside ? "Step 2: without a shadow root, the page's `button { background: red }` rule restyles the stars." : "Step 2: the stars live in a shadow root, so the page's button rule doesn't reach them, and document.querySelectorAll can't find them.",
    cfg.theme ? `Step 3: the page themes the element on purpose: a CSS custom property ${p?.customProp ? "reaches" : "doesn't reach"} the stars, and ::part(star) ${p?.partStyled ? "outlines them" : "has nothing to style"}.` : "Step 3: no theme set: the element uses its own defaults.",
    p && p.heardDocument !== null ? `Step 4: clicking a star fired rating-change: the host ${p.heardHost ? "heard it" : "didn't hear it"}, document ${p.heardDocument ? "heard it" : "didn't"}.` : "Step 4: press Click the 4th star to fire rating-change.",
    `Step 5: FormData for the surrounding form: ${p?.form ?? "…"}.`,
  ];
  const caption = stage !== null ? captions[stage] : p ? `Page CSS inside: ${p.pageCssInside ? "yes" : "no"} · stars found by document: ${p.starsFromDocument} · form sends ${p.form}.` : "Building the element…";

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="Web components"
        blurb="Custom elements let you define your own HTML tags; a shadow root gives each one a private DOM and styles. This page defines a real <ol-rating> element in your browser. Change how it's built and see what the page's CSS, scripts and forms can still reach."
      />
      <style>{`.wc-page button { background: ${PAGE_RED}; color: white; } ${cfg.theme ? `.wc-page { --star-color: ${THEME_BLUE}; } .wc-page ${TAG}::part(star) { outline: 2px dashed ${THEME_BLUE}; }` : ""}`}</style>

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Page CSS, a page script and a form surround a custom element, whose shadow root holds the star buttons and a slot for page content"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "css", to: "host", label: "styles" },
                  { from: "host", to: "shadow", label: cfg.shadow ? "shadow boundary" : "same tree", dashed: cfg.shadow },
                  { from: "slot", to: "host", label: "<slot>" },
                  { from: "host", to: "js", label: "events" },
                  { from: "host", to: "form", label: "value" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The live element and what was measured">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">live in this page</p>
                <form ref={form} onSubmit={(e) => e.preventDefault()} className="wc-page mt-2 rounded-md border border-dashed border-[var(--line)] p-3">
                  <div ref={box} />
                </form>
                <p className="mt-1 text-[11px] text-[var(--faint)]">The dashed box has the page rule <code>.wc-page button {"{"} background: red {"}"}</code>.</p>
                {p && (
                  <ul className="mt-2 grid gap-x-3 gap-y-0.5 text-xs sm:grid-cols-2">
                    <li style={{ color: p.pageCssInside ? "var(--bad)" : "var(--good)" }}>page CSS inside: {p.pageCssInside ? "yes" : "no"}</li>
                    <li>stars found by document.querySelectorAll: {p.starsFromDocument}</li>
                    <li>custom property reached: {p.customProp ? "yes" : "no"}</li>
                    <li>::part(star) applied: {p.partStyled ? "yes" : "no"}</li>
                    <li>FormData: {p.form}</li>
                    <li>rating-change heard by: {p.heardHost === null ? "click a star" : [p.heardHost && "host", p.heardDocument && "document"].filter(Boolean).join(", ") || "nobody outside"}</li>
                  </ul>
                )}
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setCfg(PLAIN)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Plain element
                </button>
                <button type="button" onClick={() => setCfg(FULL)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Shadow, themed, form-ready
                </button>
                <button type="button" onClick={clickStar} className="min-h-11 rounded-md border px-3 text-sm" style={{ borderColor: ACCENT }}>
                  Click the 4th star
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Walking…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Define the element" what="A class that extends HTMLElement, registered under a name with a dash. The browser upgrades every <ol-rating> on the page and calls the class's lifecycle callbacks as it's added, changed and removed." accent={ACCENT} active={at(0)}>
                <pre className="overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">{`class Rating extends HTMLElement {\n  static observedAttributes = ["value"];\n  connectedCallback() { … }\n  attributeChangedCallback(name, old, value) { … }\n}\ncustomElements.define("${TAG}", Rating);`}</pre>
                <ol className="mt-2 space-y-0.5 font-mono text-[10px] text-[var(--muted)]" aria-label="Lifecycle callbacks, most recent last">
                  {log.length ? log.map((l, i) => <li key={i}>{l}</li>) : <li>(no callbacks yet)</li>}
                </ol>
              </FlowStep>
              <FlowArrow label="attachShadow()" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Give it a shadow root" what="attachShadow creates a separate DOM tree inside the element. The page's selectors don't match inside it, its own styles don't leak out, and querySelector from the document can't see into it." accent={ACCENT} active={at(1)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={cfg.shadow} onChange={(e) => setCfg({ shadow: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  attachShadow({"{"} mode: &quot;open&quot; {"}"})
                </label>
              </FlowStep>
              <FlowArrow label="a theme" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Let the page style it on purpose" what="Two doors stay open through the boundary: CSS custom properties inherit into the shadow tree, and elements marked part=… can be styled from outside with ::part(). The component decides what's themeable." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={cfg.theme} onChange={(e) => setCfg({ theme: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Page sets --star-color and {TAG}::part(star)
                </label>
              </FlowStep>
              <FlowArrow label="an event" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Send events across the boundary" what="An event fired inside a shadow root stops at the root unless it's created with composed: true. Built-in events like click are composed; your custom events are not unless you say so." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={cfg.composed} onChange={(e) => setCfg({ composed: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  new CustomEvent(&quot;rating-change&quot;, {"{"} bubbles: true, composed: true {"}"})
                </label>
              </FlowStep>
              <FlowArrow label="submit" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Take part in forms" what="A custom element isn't a form control by default, so its value isn't submitted. A form-associated element (static formAssociated = true) calls internals.setFormValue() to join the form like an <input>." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={cfg.formValue} onChange={(e) => setCfg({ formValue: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  internals.setFormValue(value)
                </label>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Everything on this page is measured from the real element in your browser: computed styles, querySelectorAll, the listeners that fired and FormData.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
