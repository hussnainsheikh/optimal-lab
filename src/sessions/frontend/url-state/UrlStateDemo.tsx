"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { BASE, CATEGORIES, IN_STATE, IN_URL, PARAM, SCENARIOS, SORTS, TAGS, consequences, parse, survives, toQuery, typingHistory, type Filters, type Key, type Opts, type Scenario } from "@/lib/urlState";

const ACCENT = "var(--web)";
const START: Filters = { q: "running shoes", category: "shoes", max: 120, sort: "price-asc", tags: ["vegan"], page: 2 };
const HAND_EDITED = "?category=cars&max=-5&sort=price;DROP TABLE&page=0&tag=vegan&tag=evil";
const LABELS: Record<Key, string> = { q: "search", category: "category", max: "max price", sort: "sort", tags: "tags", page: "page" };

export default function UrlStateDemo() {
  const [f, setF] = useState<Filters>(START);
  const [o, setO] = useState<Opts>(IN_STATE);
  const [scenario, setScenario] = useState<Scenario>("reload");
  const [edited, setEdited] = useState(HAND_EDITED);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const setFilter = (p: Partial<Filters>) => setF((c) => ({ ...c, ...p }));
  const query = toQuery(f, o);
  const hist = typingHistory(f.q || "running shoes", o);
  const parsed = parse(edited, o);
  const harm = consequences(parsed);
  const sv = survives(o, scenario, f);
  const lost = sv.filter((x) => x.set && !x.kept);
  const inUrlCount = (Object.keys(PARAM) as Key[]).filter((k) => o.inUrl[k]).length;

  const nodes: MapNode[] = [
    { id: "ui", label: "Filters", sub: `${sv.filter((x) => x.set).length} set`, at: [14, 22], mobileAt: [25, 12], state: "active" },
    { id: "url", label: "URL bar", sub: query ? `${query.length} characters` : "just /products", at: [50, 22], mobileAt: [75, 12], state: inUrlCount ? "good" : "dim" },
    { id: "history", label: "History", sub: `${hist.entries.length} entr${hist.entries.length === 1 ? "y" : "ies"} for one search`, at: [86, 22], mobileAt: [75, 45], state: hist.pushed > 2 ? "bad" : "good" },
    { id: "server", label: "Server render", sub: o.validate ? "checks every param" : "trusts the params", at: [86, 78], mobileAt: [75, 80], state: o.validate ? "good" : "bad" },
    { id: "colleague", label: "A colleague", sub: lost.length && scenario === "share" ? `misses ${lost.length} filter${lost.length === 1 ? "" : "s"}` : "opens the link", at: [50, 78], mobileAt: [25, 80], state: scenario === "share" ? (lost.length ? "bad" : "good") : "idle" },
    { id: "reload", label: "Reload / Back", sub: lost.length && scenario !== "share" ? `${lost.length} filter${lost.length === 1 ? "" : "s"} lost` : "everything restored", at: [14, 78], mobileAt: [25, 45], state: scenario !== "share" ? (lost.length ? "bad" : "good") : "idle" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("p", ["ui", "url"], { label: `${inUrlCount} of 6 in the URL`, tone: inUrlCount ? "accent" : "bad" })
    : stage === 1 ? hops("w", ["url", "server"], { label: query ? "?…" : "no params" })
    : stage === 2 ? hops("h", ["url", "history"], { label: o.typing === "push" ? `${hist.pushed} pushes` : "replace", tone: hist.pushed > 2 ? "bad" : "good" })
    : stage === 3 ? hops("v", ["server", "ui"], { label: o.validate ? "checked" : "as typed", tone: harm.length ? "bad" : "good" })
    : stage === 4 ? hops("s", ["url", scenario === "share" ? "colleague" : "reload", "ui"], { label: SCENARIOS.find((s) => s.id === scenario)!.label, tone: lost.length ? "bad" : "good" })
    : [];

  const captions = [
    inUrlCount ? `Step 1: ${inUrlCount} of the 6 filters live in the URL; the rest live in component state.` : "Step 1: every filter lives in component state; the URL stays /products.",
    query ? `Step 2: the filters become ${query.length} characters of query string, written with URLSearchParams.` : "Step 2: nothing is written to the URL.",
    o.inUrl.q ? (o.typing === "push" ? `Step 3: pushState on every keystroke adds ${hist.pushed} history entries; Back goes to "${hist.backGoesTo.replace(BASE, "")}".` : "Step 3: replaceState updates the current entry while typing, so Back leaves the search page.") : "Step 3: the search box isn't in the URL, so typing doesn't touch history.",
    harm.length ? `Step 4: a hand-edited URL is used as is: ${harm[0]}.` : "Step 4: every param is checked on the way in; bad values fall back to defaults.",
    lost.length ? `Step 5: ${SCENARIOS.find((s) => s.id === scenario)!.label.toLowerCase()}: ${lost.map((x) => LABELS[x.key]).join(", ")} ${lost.length === 1 ? "is" : "are"} lost.` : `Step 5: ${SCENARIOS.find((s) => s.id === scenario)!.label.toLowerCase()}: every filter comes back.`,
  ];
  const caption = stage !== null ? captions[stage] : `${inUrlCount} of 6 filters in the URL · ${lost.length ? `${lost.length} lost on ${SCENARIOS.find((s) => s.id === scenario)!.label.toLowerCase()}` : "nothing lost"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="State in the URL"
        blurb="Filters, sort order, the page number and the search term are state the person chose. Kept in component state they vanish on reload and never reach a shared link. Kept in the URL they survive both, as long as you don't flood the history and you check what you read back."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Filter controls write to the URL bar and the browser history; the server reads the URL to render; a colleague opens the shared link; reload and Back restore from the URL"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "ui", to: "url", label: "write", dim: !inUrlCount },
                  { from: "url", to: "history", label: o.typing === "push" ? "pushState" : "replaceState" },
                  { from: "url", to: "server", label: "searchParams" },
                  { from: "url", to: "colleague", label: "link" },
                  { from: "reload", to: "ui", label: "restore" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The product list's filters and its URL">
                <p className="break-all rounded-md bg-[var(--inset)] px-2 py-1.5 font-mono text-[11px]">
                  <span className="text-[var(--faint)]">{BASE}</span>
                  <span style={{ color: ACCENT }}>{query}</span>
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="block text-xs">
                    <span className="text-[var(--muted)]">Search</span>
                    <input value={f.q} onChange={(e) => setFilter({ q: e.target.value })} className="mt-1 h-11 w-full rounded-md border border-[var(--line)] bg-[var(--inset)] px-2 text-sm" />
                  </label>
                  <label className="block text-xs">
                    <span className="text-[var(--muted)]">Category</span>
                    <select value={f.category} onChange={(e) => setFilter({ category: e.target.value })} className="mt-1 h-11 w-full rounded-md border border-[var(--line)] bg-[var(--inset)] px-2 text-sm">
                      {CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs">
                    <span className="text-[var(--muted)]">Max price: ${f.max}</span>
                    <input type="range" min={20} max={500} step={10} value={f.max} onChange={(e) => setFilter({ max: Number(e.target.value) })} className="mt-1 h-11 w-full" style={{ accentColor: ACCENT }} />
                  </label>
                  <label className="block text-xs">
                    <span className="text-[var(--muted)]">Sort</span>
                    <select value={f.sort} onChange={(e) => setFilter({ sort: e.target.value })} className="mt-1 h-11 w-full rounded-md border border-[var(--line)] bg-[var(--inset)] px-2 text-sm">
                      {SORTS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 text-xs">
                  {TAGS.map((t) => (
                    <label key={t} className="flex min-h-11 items-center gap-1.5">
                      <input type="checkbox" checked={f.tags.includes(t)} onChange={(e) => setFilter({ tags: e.target.checked ? [...f.tags, t] : f.tags.filter((x) => x !== t) })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                      {t}
                    </label>
                  ))}
                  <span className="ml-auto flex items-center gap-1">
                    <button type="button" onClick={() => setFilter({ page: Math.max(1, f.page - 1) })} className="min-h-11 rounded-md border border-[var(--line)] px-3" aria-label="Previous page">
                      ‹
                    </button>
                    <span className="font-mono">page {f.page}</span>
                    <button type="button" onClick={() => setFilter({ page: f.page + 1 })} className="min-h-11 rounded-md border border-[var(--line)] px-3" aria-label="Next page">
                      ›
                    </button>
                  </span>
                </div>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Then" accent={ACCENT} value={scenario} onChange={setScenario} options={SCENARIOS.map((s) => ({ id: s.id, label: s.label }))} />
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(IN_STATE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  All in useState
                </button>
                <button type="button" onClick={() => setO(IN_URL)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  In the URL, done right
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Browsing…">
                {`Filter, then ${SCENARIOS.find((s) => s.id === scenario)!.label.toLowerCase()}`}
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Pick what belongs in the URL" what="Anything a person would expect to survive a reload or to send to someone: filters, sort, page, search, the selected tab. Not hover states, open menus or private drafts." accent={ACCENT} active={at(0)}>
                <div className="flex flex-wrap gap-x-3">
                  {(Object.keys(PARAM) as Key[]).map((k) => (
                    <label key={k} className="flex min-h-11 items-center gap-1.5 text-sm">
                      <input type="checkbox" checked={o.inUrl[k]} onChange={(e) => set({ inUrl: { ...o.inUrl, [k]: e.target.checked } })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                      {LABELS[k]}
                    </label>
                  ))}
                </div>
              </FlowStep>
              <FlowArrow label="URLSearchParams" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Write it as a query string" what="URLSearchParams encodes the values (a space becomes +) and repeats a key for lists. Leaving out values that equal the default keeps links short and gives one URL per view." accent={ACCENT} active={at(1)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.omitDefaults} onChange={(e) => set({ omitDefaults: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Leave out default values
                </label>
                <p className="break-all font-mono text-[11px] text-[var(--muted)]">{query || "(empty)"}</p>
              </FlowStep>
              <FlowArrow label="every keystroke" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Don't flood the history" what="pushState adds an entry, so updating the URL on every keystroke makes Back step through the search one letter at a time. Use replaceState while typing (or debounce), and push when the person commits to a new view." accent={ACCENT} active={at(2)}>
                <Choices accent={ACCENT} value={o.typing} onChange={(v) => set({ typing: v })} options={[{ id: "push", label: "pushState" }, { id: "replace", label: "replaceState" }]} />
                <p className="mt-2 text-xs text-[var(--muted)]">
                  Typing &quot;{f.q || "running shoes"}&quot; adds {hist.pushed} entr{hist.pushed === 1 ? "y" : "ies"}. Back goes to: <span className="break-all font-mono">{hist.backGoesTo.replace(BASE, "/products")}</span>
                </p>
              </FlowStep>
              <FlowArrow label="a URL someone edited" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Read it back, and check it" what="A URL is input from outside: people edit it, old links carry values that no longer exist, and anyone can send anything. Parse each param, keep only known values in range, and fall back to the default otherwise." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.validate} onChange={(e) => set({ validate: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Validate params, with defaults
                </label>
                <label className="block text-xs">
                  <span className="text-[var(--muted)]">Query string to load</span>
                  <input value={edited} onChange={(e) => setEdited(e.target.value)} className="mt-1 h-11 w-full rounded-md border border-[var(--line)] bg-[var(--inset)] px-2 font-mono text-xs" />
                </label>
                <ul className="mt-2 space-y-0.5 font-mono text-[11px]">
                  {parsed.notes.map((n) => (
                    <li key={n.key} className="break-all" style={{ color: n.ok ? "var(--muted)" : o.validate ? "var(--good)" : "var(--bad)" }}>
                      {LABELS[n.key]}: &quot;{n.raw}&quot; → {n.used}
                      {!n.ok && (o.validate ? " (default)" : " (used as is)")}
                    </li>
                  ))}
                </ul>
                {harm.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-[11px] text-[var(--bad)]">
                    {harm.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                )}
              </FlowStep>
              <FlowArrow label="later" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Reload, share, go Back" what="Whatever is in the URL comes back with the page. Whatever was only in component state is gone when the component is." accent={ACCENT} active={at(4)}>
                <ul className="grid gap-0.5 text-xs sm:grid-cols-2">
                  {sv.map((x) => (
                    <li key={x.key} style={{ color: !x.set ? "var(--faint)" : x.kept ? "var(--good)" : "var(--bad)" }}>
                      {LABELS[x.key]}: {x.note}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The URL is built and parsed with the browser&apos;s URLSearchParams; the history stack is simulated. Defaults are category all, max $200, sort by relevance, page 1.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
