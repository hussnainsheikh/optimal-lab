"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { ACTORS, BITS, fromOctal, lsString, octal, WHO, type Bit, type Perms, type Who } from "@/lib/filePermissions";

const ACCENT = "var(--ops)";
const ACTION: Record<Bit, string> = { r: "read it", w: "edit it", x: "run it" };

export default function PermissionsDemo() {
  const [p, setP] = useState<Perms>(fromOctal("754"));
  const flip = (w: Who, b: Bit) => setP((x) => ({ ...x, [w]: { ...x[w], [b]: !x[w][b] } }));
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="File permissions" blurb="Every file has an owner, a group, and three sets of read/write/execute bits: for the owner, for members of the group, and for everyone else. Linux checks exactly one set per user: the first that applies." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Permission bits">
              <p className="font-mono text-sm">{lsString(p)} alice web deploy.sh</p>
              <p className="mt-1 font-mono text-xs text-[var(--muted)]">chmod {octal(p)} deploy.sh</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {WHO.map((w) => (
                  <div key={w.id} className="rounded-lg border border-[var(--line)] p-2">
                    <p className="text-xs text-[var(--muted)]">{w.label}</p>
                    <div className="mt-2 flex gap-1">
                      {BITS.map((b) => <button key={b} type="button" onClick={() => flip(w.id, b)} aria-pressed={p[w.id][b]} className="grid h-11 flex-1 place-items-center rounded-md border font-mono text-sm" style={{ background: p[w.id][b] ? ACCENT : "transparent", color: p[w.id][b] ? "var(--on-accent)" : "var(--faint)", borderColor: p[w.id][b] ? ACCENT : "var(--line)" }}>{b}</button>)}
                    </div>
                    <p className="mt-1 text-center font-mono text-xs text-[var(--faint)]">{(p[w.id].r ? 4 : 0) + (p[w.id].w ? 2 : 0) + (p[w.id].x ? 1 : 0)}</p>
                  </div>
                ))}
              </div>
              <table className="mt-4 w-full text-sm">
                <thead><tr className="text-left text-xs text-[var(--faint)]"><th className="font-normal">user</th><th className="font-normal">uses</th>{BITS.map((b) => <th key={b} className="font-normal">{ACTION[b]}</th>)}</tr></thead>
                <tbody>{ACTORS.map((a) => <tr key={a.name}><td className="py-1">{a.name}</td><td className="text-xs text-[var(--muted)]">{WHO.find((w) => w.id === a.cls)!.label.split(" ")[0]}</td>{BITS.map((b) => <td key={b} style={{ color: p[a.cls][b] ? "var(--good)" : "var(--bad)" }}>{p[a.cls][b] ? "✓" : "✗"}</td>)}</tr>)}</tbody>
              </table>
            </section>
          }
          panel={
            <SystemMapPanel caption={`Each digit is r=4 + w=2 + x=1. ${octal(p)} gives alice ${lsString(p).slice(1, 4)}, the web group ${lsString(p).slice(4, 7)}, everyone else ${lsString(p).slice(7)}.${p.o.w ? " Anyone on the machine can modify this script: dangerous." : ""}`}>
              <Choices label="Common modes" accent={ACCENT} value={octal(p)} onChange={(v) => setP(fromOctal(v))} options={["755", "644", "700", "750", "777"].map((x) => ({ id: x, label: x }))} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Three classes, one check" what="If you own the file, only the owner bits count; else if you're in its group, the group bits; else the others bits." accent={ACCENT}><p className="text-sm text-[var(--muted)]">An owner can have fewer rights than others.</p></FlowStep>
              <FlowArrow label="read the string" accent={ACCENT} />
              <FlowStep n={2} title="rwx and octal are the same thing" what="rwxr-xr-- is 7 5 4. 755 for programs, 644 for files, 600 for secrets like SSH keys." accent={ACCENT}><p className="font-mono text-xs">chmod 600 ~/.ssh/id_ed25519</p></FlowStep>
              <FlowArrow label="directories" accent={ACCENT} />
              <FlowStep n={3} title="On directories, x means enter" what="r lists names, w creates and deletes files inside, x lets you open what's inside." accent={ACCENT}><p className="text-sm text-[var(--muted)]">You can delete a read-only file in a writable directory.</p></FlowStep>
              <FlowArrow label="in containers" accent={ACCENT} />
              <FlowStep n={4} title="Least privilege" what="Run services as their own user, not root; never 777. In containers, set USER and mount secrets read-only." accent={ACCENT} active={p.o.w}><p className="font-mono text-xs">chown app:app /srv/app</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
