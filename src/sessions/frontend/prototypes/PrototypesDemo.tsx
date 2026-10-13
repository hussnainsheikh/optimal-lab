"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { CHAIN, lookup, LOOKUPS } from "@/lib/protoChain";

const ACCENT = "var(--web)";

export default function PrototypesDemo() {
  const [p, setP] = useState("speak");
  const r = lookup(p);
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Prototypes and the prototype chain" blurb="JavaScript objects don't copy methods from classes. Each object links to a prototype, which links to another, up to Object.prototype. Reading a property walks that chain until it finds it, or reaches the end and returns undefined." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Prototype chain">
              <pre className="rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{"class Animal { speak() {} eat() {} }\nclass Dog extends Animal { bark() {} }\nconst rex = new Dog(); rex.name = \"Rex\"; rex.age = 3;"}</pre>
              <ol className="mt-3 space-y-1">
                {CHAIN.map((c, i) => {
                  const visited = r.visited.includes(i), found = r.foundAt === i;
                  return (
                    <li key={c.name}>
                      {i > 0 && <p className="pl-4 text-[11px] text-[var(--faint)]">↓ [[Prototype]]</p>}
                      <div className="rounded-lg border-2 p-2" style={{ borderColor: found ? "var(--good)" : visited ? ACCENT : "var(--line)", opacity: visited ? 1 : 0.4 }}>
                        <p className="text-sm">{c.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1">{c.props.map((x) => <span key={x} className="rounded px-1.5 font-mono text-xs" style={{ background: x === p && found ? "var(--good)" : "var(--inset)", color: x === p && found ? "var(--on-accent)" : undefined }}>{x}</span>)}</div>
                      </div>
                    </li>
                  );
                })}
                <li className="pl-4 text-[11px] text-[var(--faint)]">↓ null</li>
              </ol>
              <p className="mt-2 font-mono text-sm">rex.{p} → {r.foundAt >= 0 ? <span style={{ color: "var(--good)" }}>found on {CHAIN[r.foundAt].name}</span> : <span style={{ color: "var(--bad)" }}>undefined</span>}</p>
            </section>
          }
          panel={<SystemMapPanel caption={r.foundAt === 0 ? "An own property: found on the object itself, no walking needed." : r.foundAt > 0 ? `Not on rex, so the engine follows the chain: ${r.visited.length} hops to ${CHAIN[r.foundAt].name}. Every Dog shares that one function.` : "Checked every object up to null without finding it: the result is undefined, not an error."}><Choices label="Read rex." accent={ACCENT} value={p} onChange={setP} options={LOOKUPS.map((x) => ({ id: x, label: x }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Objects link to a prototype" what="Every object has a hidden [[Prototype]] link. Object.getPrototypeOf(rex) is Dog.prototype." accent={ACCENT}><p className="text-sm text-[var(--muted)]">__proto__ is the old accessor.</p></FlowStep>
              <FlowArrow label="read" accent={ACCENT} />
              <FlowStep n={2} title="Lookups walk the chain" what="Own properties first, then each prototype in turn, ending at Object.prototype and null." accent={ACCENT} active={r.foundAt > 0}><p className="text-sm text-[var(--muted)]">Writes always go on the object itself.</p></FlowStep>
              <FlowArrow label="sharing" accent={ACCENT} />
              <FlowStep n={3} title="Methods live once, on the prototype" what="A thousand dogs share one bark function. class syntax is sugar over exactly this." accent={ACCENT}><p className="text-sm text-[var(--muted)]">extends sets up the chain.</p></FlowStep>
              <FlowArrow label="careful" accent={ACCENT} />
              <FlowStep n={4} title="Don't modify built-in prototypes" what="Adding to Array.prototype affects every array everywhere. Prototype pollution is also a security bug." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Use Object.create(null) for plain maps.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
