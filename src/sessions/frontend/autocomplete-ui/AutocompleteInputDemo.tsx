"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { KEYS, LATENCY, NAIVE, TUNED, simulate, suggest, type Opts } from "@/lib/autocompleteInput";

const ACCENT = "var(--web)";
const SPAN = 2400;

export default function AutocompleteInputDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const r = simulate(o);

  const nodes: MapNode[] = [
    { id: "keys", label: "Keyboard", sub: `${KEYS.length} edits`, at: [14, 22], mobileAt: [25, 12], state: "active" },
    { id: "input", label: "Search box", sub: o.debounce ? `waits ${o.debounce} ms` : "fires every key", at: [50, 22], mobileAt: [75, 12], state: o.debounce ? "good" : "wait" },
    { id: "cache", label: "Cache", sub: o.cache ? `${r.cacheHits} hit${r.cacheHits === 1 ? "" : "s"}` : "off", at: [86, 22], mobileAt: [75, 45], state: o.cache ? "good" : "dim" },
    { id: "server", label: "Search API", sub: `${r.requests} requests`, at: [86, 78], mobileAt: [75, 80], state: r.requests > 4 ? "bad" : "good" },
    { id: "guard", label: "Response handler", sub: o.latestOnly ? "drops old answers" : "shows whatever arrives", at: [50, 78], mobileAt: [25, 80], state: o.latestOnly ? "good" : "bad" },
    { id: "list", label: "Suggestion list", sub: `wrong for ${r.staleMs} ms`, at: [14, 78], mobileAt: [25, 45], state: r.staleMs > 300 ? "bad" : "good" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("k", ["keys", "input", "server"], { label: `${r.requests} requests`, tone: r.requests > 4 ? "bad" : "accent" })
    : stage === 1 ? hops("d", ["keys", "input"], { label: o.debounce ? `debounce ${o.debounce} ms` : "no wait", tone: o.debounce ? "good" : "bad" })
    : stage === 2 ? hops("g", ["server", "guard", "list"], { label: o.latestOnly ? "latest only" : `${r.staleShown} stale shown`, tone: o.latestOnly ? "good" : "bad" })
    : stage === 3 ? hops("c", ["input", "cache", "list"], { label: o.cache ? `${r.cacheHits} from cache` : "no cache", tone: o.cache ? "good" : "accent" })
    : stage === 4 ? hops("a", ["keys", "list"], { label: "↓ ↑ Enter Esc", tone: "good" })
    : [];

  const captions = [
    `Step 1: typing "running" and deleting back to "run" sends ${r.requests} request${r.requests === 1 ? "" : "s"}${o.minChars > 1 ? `, none for a single letter` : ""}.`,
    o.debounce ? `Step 2: requests wait for a ${o.debounce} ms pause in typing, so mid-word prefixes are never sent.` : "Step 2: with no debounce every keystroke is a request, and the server is slowest for the short prefixes.",
    o.latestOnly ? "Step 3: answers to questions the box no longer asks are dropped, so the list never goes backwards." : `Step 3: the slow answer for "run" arrives after the one for "running", and replaces it: the list shows ${r.staleShown} stale result set${r.staleShown === 1 ? "" : "s"}.`,
    o.cache ? `Step 4: going back to "run" is answered from the cache${r.cacheHits ? ", instantly" : ""}.` : 'Step 4: going back to "run" asks the server again.',
    "Step 5: the live box below is a combobox: arrow keys move through suggestions, Enter picks one, Escape closes the list, and a screen reader hears the active option.",
  ];
  const caption = stage !== null ? captions[stage] : `${r.requests} requests · list wrong for ${r.staleMs} ms · ${r.flashes} list changes.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · case study"
        title="An autocomplete input"
        blurb="A search box that suggests as you type looks simple. Then it sends a request per keystroke, the answers come back in the wrong order, and it can't be used without a mouse. Replay one typing session with and without each fix, then try a working one."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Keystrokes go into the search box, which asks the search API or a cache; a response handler decides what the suggestion list shows"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "keys", to: "input", label: "keydown" },
                  { from: "input", to: "server", label: "GET /suggest" },
                  { from: "input", to: "cache", label: "lookup", dim: !o.cache },
                  { from: "server", to: "guard", label: "JSON" },
                  { from: "guard", to: "list", label: "render" },
                  { from: "cache", to: "list", label: "hit", dim: !o.cache },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <Timeline r={r} />
              <LiveCombobox o={o} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Fetch on every key
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  All four fixes
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Typing…">
                Replay the typing
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Every keystroke is a question" what='Typing "running" asks seven questions: r, ru, run… Short prefixes match the most rows, so they are the slowest to answer and the least useful. A minimum length skips the first ones.' accent={ACCENT} active={at(0)}>
                <Choices accent={ACCENT} value={String(o.minChars) as "1" | "2"} onChange={(v) => set({ minChars: Number(v) as 1 | 2 })} options={[{ id: "1", label: "From 1 letter" }, { id: "2", label: "From 2 letters" }]} />
                <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">server time: {Object.entries(LATENCY).map(([q, ms]) => `${q} ${ms}ms`).join(" · ")}</p>
              </FlowStep>
              <FlowArrow label="debounce" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Wait for a pause" what="Debouncing starts a timer on each keystroke and only sends when the timer runs out. Too short and it barely helps; too long and the box feels sluggish." accent={ACCENT} active={at(1)}>
                <Choices accent={ACCENT} value={String(o.debounce) as "0" | "150" | "300"} onChange={(v) => set({ debounce: Number(v) as 0 | 150 | 300 })} options={[{ id: "0", label: "No debounce" }, { id: "150", label: "150 ms" }, { id: "300", label: "300 ms" }]} />
              </FlowStep>
              <FlowArrow label="responses" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Ignore answers to old questions" what="Requests don't come back in the order they were sent. Without a guard, a slow answer for an earlier prefix overwrites the right one. Keep only the response for what's in the box now, and abort the rest with an AbortController." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.latestOnly} onChange={(e) => set({ latestOnly: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Show only the answer for the current text
                </label>
              </FlowStep>
              <FlowArrow label="repeat questions" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Remember answers" what="People backspace and retype. A small cache keyed by the query answers a repeat instantly and saves a request." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.cache} onChange={(e) => set({ cache: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Cache results by query
                </label>
              </FlowStep>
              <FlowArrow label="keyboard" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Make it work from the keyboard" what="The ARIA combobox pattern: the input has role=combobox and aria-expanded, the list is a listbox, and aria-activedescendant points at the highlighted option so screen readers announce it while focus stays in the input." accent={ACCENT} active={at(4)}>
                <pre className="overflow-x-auto whitespace-pre rounded-md bg-[var(--inset)] p-2 font-mono text-[10px] leading-relaxed">{`<input role="combobox" aria-expanded="true"\n       aria-controls="list" aria-activedescendant="opt-2">\n<ul id="list" role="listbox">\n  <li id="opt-2" role="option" aria-selected="true">…`}</pre>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The replay is an event-by-event simulation with fixed keystroke times and server latencies; the box above runs the same settings for real in your browser, against a simulated server.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Timeline({ r }: { r: ReturnType<typeof simulate> }) {
  const x = (t: number) => `${(t / SPAN) * 100}%`;
  const sends = r.events.filter((e) => e.kind === "send");
  const responses = r.events.filter((e) => e.kind === "response");
  const shows = r.events.filter((e) => e.kind === "show");
  const ignored = new Set(r.events.filter((e) => e.kind === "ignored").map((e) => `${e.q}@${e.t}`));
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The typing session as a timeline">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
        {r.requests} requests · list wrong for {r.staleMs} ms
      </p>
      <div className="relative mt-2 h-5">
        {KEYS.map((k) => (
          <span key={k.t} className="absolute top-0 -translate-x-1/2 font-mono text-[9px]" style={{ left: x(k.t) }} title={`${k.t} ms: "${k.value}"`}>
            ▼
          </span>
        ))}
      </div>
      <ul className="space-y-0.5">
        {sends.map((s, i) => {
          const resp = responses.find((x2) => x2.q === s.q && x2.t >= s.t);
          const end = resp ? resp.t : s.t + 20;
          const dropped = resp && ignored.has(`${s.q}@${resp.t}`);
          return (
            <li key={i} className="relative h-3.5">
              <span className="absolute top-0.5 h-2.5 rounded-sm" style={{ left: x(s.t), width: `max(4px, ${((end - s.t) / SPAN) * 100}%)`, background: dropped ? "var(--line-strong)" : ACCENT, opacity: 0.8 }} />
              <span className="absolute top-0 font-mono text-[9px] text-[var(--muted)]" style={{ left: `calc(${x(end)} + 4px)` }}>
                {s.q}
                {dropped ? " (dropped)" : ""}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-[var(--muted)]">
        List shows: {shows.map((s) => `"${s.q}" at ${s.t} ms`).join(" → ") || "nothing yet"}
      </p>
      <p className="text-[10px] text-[var(--faint)]">▼ keystrokes; bars run from request to response, over {SPAN / 1000} s.</p>
    </section>
  );
}

function LiveCombobox({ o }: { o: Opts }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [sent, setSent] = useState(0);
  const latest = useRef(0);
  const cache = useRef(new Map<string, string[]>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const ask = (q: string) => {
    if (q.trim().length < o.minChars) {
      setItems([]);
      return;
    }
    const hit = cache.current.get(q);
    if (o.cache && hit) {
      setItems(hit);
      setOpen(true);
      return;
    }
    const ticket = ++latest.current;
    setSent((n) => n + 1);
    const delay = LATENCY[q] ?? Math.max(90, 400 - q.length * 40);
    setTimeout(() => {
      if (o.latestOnly && ticket !== latest.current) return;
      const result = suggest(q);
      cache.current.set(q, result);
      setItems(result);
      setOpen(true);
      setActive(-1);
    }, delay);
  };

  const onChange = (q: string) => {
    setValue(q);
    if (timer.current) clearTimeout(timer.current);
    if (o.debounce) timer.current = setTimeout(() => ask(q), o.debounce);
    else ask(q);
  };

  const pick = (s: string) => {
    setValue(s);
    setOpen(false);
    setActive(-1);
  };

  const listId = `${id}-list`;
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Try the autocomplete">
      <label htmlFor={`${id}-input`} className="text-xs text-[var(--muted)]">
        Try it: search products ({sent} request{sent === 1 ? "" : "s"} sent)
      </label>
      <div className="relative mt-1">
        <input
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter" && active >= 0) {
              e.preventDefault();
              pick(items[active]);
            } else if (e.key === "Escape") setOpen(false);
          }}
          className="h-11 w-full rounded-md border border-[var(--line)] bg-[var(--inset)] px-2 text-sm"
          placeholder="running"
        />
        {open && items.length > 0 && (
          <ul id={listId} role="listbox" className="absolute inset-x-0 top-12 z-10 rounded-md border border-[var(--line)] bg-[var(--panel)] py-1 shadow-lg">
            {items.map((s, i) => (
              <li key={s} id={`${id}-opt-${i}`} role="option" aria-selected={i === active} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)} className="cursor-pointer px-3 py-2 text-sm" style={{ background: i === active ? `color-mix(in srgb, ${ACCENT} 18%, transparent)` : undefined }}>
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-1 text-[10px] text-[var(--faint)]">Uses the settings above: debounce, minimum length, latest-only and the cache.</p>
    </section>
  );
}
