"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState, type ReactNode } from "react";
import { Choices } from "@/components/session/ui";
import { build, count, lookup, PREFIXES, WORDS, type Node } from "@/lib/trie";

const ACCENT = "var(--dsa)";
const ROOT = build();

export default function TrieDemo() {
  const [prefix, setPrefix] = useState("car");
  const r = lookup(ROOT, prefix);
  const inSub = (path: string) => r.found && path.startsWith(prefix) && path.length >= prefix.length;
  const render = (n: Node, depth: number): ReactNode => (
    <ul className={depth ? "ml-4 border-l border-[var(--line)] pl-2" : ""}>
      {n.kids.map((k) => {
        const onPath = r.walked.includes(k.path);
        return (
          <li key={k.path} className="py-0.5">
            <span className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-sm" style={{ background: onPath ? ACCENT : inSub(k.path) ? "var(--inset)" : undefined, color: onPath ? "var(--on-accent)" : inSub(k.path) ? "var(--text)" : "var(--muted)" }}>
              {k.ch}{k.end && <span className="text-[10px]" style={{ color: onPath ? "var(--on-accent)" : "var(--good)" }}>● {k.path}</span>}
            </span>
            {k.kids.length > 0 && render(k, depth + 1)}
          </li>
        );
      })}
    </ul>
  );
  return (
    <SessionPage>
      <SessionHeader kicker="DSA · interactive" title="Trie: prefix lookups" blurb="A trie stores words letter by letter, sharing common beginnings. To find every word that starts with a prefix, walk one node per letter, then collect everything below. The cost depends on the prefix length, not on how many words there are." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The trie">
              <p className="font-mono text-xs text-[var(--faint)]">{WORDS.length} words · {count(ROOT) - 1} nodes · ● marks the end of a word</p>
              <div className="mt-3">{render(ROOT, 0)}</div>
              <p className="mt-4 font-mono text-sm">“{prefix}” → {r.found ? (r.words.length ? r.words.join(", ") : "no words") : "no node: nothing starts with it"}</p>
            </section>
          }
          panel={<SystemMapPanel caption={r.found ? `${r.steps} steps down the tree, then collect the ${r.words.length} words below.` : `Stopped after ${r.steps} steps: there's no '${prefix[r.steps]}' child.`}><Choices label="Type a prefix" accent={ACCENT} value={prefix} onChange={setPrefix} options={PREFIXES.map((p) => ({ id: p, label: p }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="One node per letter" what="Each node has up to 26 children (or a map). Shared prefixes share nodes: car, card and care reuse c-a-r." accent={ACCENT}><p className="font-mono text-xs">{"{ children: Map<char, Node>, isWord }"}</p></FlowStep>
              <FlowArrow label="walk the prefix" accent={ACCENT} />
              <FlowStep n={2} title="Walk the prefix" what="Follow one child per letter. If a child is missing, no word starts that way: stop early." accent={ACCENT} active><p className="text-sm text-[var(--muted)]">O(length of prefix).</p></FlowStep>
              <FlowArrow label="collect" accent={ACCENT} />
              <FlowStep n={3} title="Collect the subtree" what="Every word-end below the last node is a match. Autocomplete keeps the most popular ones per node." accent={ACCENT} active={r.found}><p className="text-sm text-[var(--muted)]">Costs grow with matches, not the dictionary.</p></FlowStep>
              <FlowArrow label="trade-offs" accent={ACCENT} />
              <FlowStep n={4} title="Memory for speed" what="Tries use more memory than a sorted list. Compressed tries merge single-child chains to save space." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Used in autocomplete, spell check and IP routing.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
