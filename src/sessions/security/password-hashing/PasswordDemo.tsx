"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { PASSWORDS, STORAGES, USERS, crackSeconds, human, type Storage } from "@/lib/passwordHashing";

const ACCENT = "var(--sec)";

export default function PasswordDemo() {
  const [storage, setStorage] = useState<Storage>("sha256");
  const [pwId, setPwId] = useState("lower8");
  const st = STORAGES.find((s) => s.id === storage)!;
  const pw = PASSWORDS.find((p) => p.id === pwId)!;
  const t = crackSeconds(storage, pw.space);
  const column = (u: (typeof USERS)[number]) => (storage === "plain" ? u.password : storage === "sha256" ? u.sha : storage === "salted" ? `${u.salt}:${u.salted}` : u.bcrypt);

  return (
    <SessionPage>
      <SessionHeader kicker="Security · interactive" title="Storing passwords" blurb="Assume the user table leaks: it eventually does. What the attacker can do next depends entirely on how you stored the passwords. Hashes shown are illustrative; guess rates are rough single-GPU figures." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The leaked table">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">The leaked users table · {st.label}</p>
              <table className="mt-2 w-full font-mono text-xs">
                <thead><tr className="text-left text-[var(--faint)]"><th className="font-normal">user</th><th className="font-normal">password column</th></tr></thead>
                <tbody>
                  {USERS.map((u) => {
                    const dupe = storage === "sha256" && USERS.filter((x) => x.sha === u.sha).length > 1;
                    return <tr key={u.user}><td className="py-1">{u.user}</td><td className="break-all" style={{ color: storage === "plain" || dupe ? "var(--bad)" : undefined }}>{column(u)}{dupe ? "  ← same as another user" : ""}</td></tr>;
                  })}
                </tbody>
              </table>
              <div className="mt-4 rounded-lg border p-3" style={{ borderColor: t < 86400 ? "var(--bad)" : "var(--good)" }}>
                <p className="text-sm">Time to try every possible “{pw.label}” password:</p>
                <p className="mt-1 font-mono text-2xl" style={{ color: t < 86400 ? "var(--bad)" : "var(--good)" }}>{human(t)}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{pw.note}</p>
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={st.note}>
              <Choices label="How passwords are stored" accent={ACCENT} value={storage} onChange={setStorage} options={STORAGES.map((s) => ({ id: s.id, label: s.label }))} />
              <Choices label="The user's password" accent={ACCENT} value={pwId} onChange={setPwId} options={PASSWORDS.map((p) => ({ id: p.id, label: p.label }))} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Never store the password" what="Store a one-way hash. At login, hash what the user typed and compare." accent={ACCENT} active={storage === "plain"}><p className="text-sm text-[var(--muted)]">Plain text turns a leak into instant account takeover everywhere the password was reused.</p></FlowStep>
              <FlowArrow label="hash it" accent={ACCENT} />
              <FlowStep n={2} title="Fast hashes are too fast" what="SHA-256 is built for speed. A GPU tries billions of guesses a second, and identical passwords give identical hashes." accent={ACCENT} active={storage === "sha256"}><p className="text-sm text-[var(--muted)]">alice and bob share a hash, so cracking one cracks both.</p></FlowStep>
              <FlowArrow label="add a salt" accent={ACCENT} />
              <FlowStep n={3} title="A salt per user" what="Random bytes mixed in before hashing: same password, different hash. Kills precomputed tables, but each guess is still cheap." accent={ACCENT} active={storage === "salted"}><p className="text-sm text-[var(--muted)]">Salts are stored next to the hash; they aren&apos;t secret.</p></FlowStep>
              <FlowArrow label="make it slow" accent={ACCENT} />
              <FlowStep n={4} title="Use a slow password hash" what="bcrypt, scrypt or Argon2 are salted and deliberately expensive, with a cost you raise as hardware gets faster. Logins barely notice; attackers do." accent={ACCENT} active={storage === "bcrypt"}>
                <ul className="space-y-1 text-sm">{STORAGES.map((s) => <li key={s.id} className="flex justify-between gap-3"><span>{s.label}</span><span className="font-mono">{human(crackSeconds(s.id, pw.space))}</span></li>)}</ul>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
