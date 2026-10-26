"use client";

import { useId, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { CHECKS, LAYERED, LOOSE, PATHS, TAKEN, TIMINGS, submit, typingFeedback, type Field, type Layer, type Opts, type Path, type Timing, type Values } from "@/lib/formValidation";

const ACCENT = "var(--web)";
const MESSY: Values = { email: "sam@example", username: "sam", password: "password1234", confirm: "password123" };
const VALID: Values = { email: "dana@example.com", username: "dana_k", password: "correct horse 9", confirm: "correct horse 9" };
const FIELDS: { id: Field; label: string; type: string }[] = [
  { id: "email", label: "Email", type: "email" },
  { id: "username", label: "Username", type: "text" },
  { id: "password", label: "Password", type: "password" },
  { id: "confirm", label: "Confirm password", type: "password" },
];
const LAYER_LABEL: Record<Layer, string> = { browser: "the browser", client: "the client schema", server: "the server", db: "the database" };

export default function FormsDemo() {
  const [v, setV] = useState<Values>(MESSY);
  const [o, setO] = useState<Opts>(LOOSE);
  const [path, setPath] = useState<Path>("browser");
  const [timing, setTiming] = useState<Timing>("keystroke");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const ids = useId();
  const r = submit(v, o, path);
  const tf = typingFeedback("dana@example.com", timing);
  const checksFor = (layer: Layer) => CHECKS.filter((c) => c.layer === layer);
  const fieldErrors = (f: Field) => r.errors.filter((e) => e.field === f);
  const accepted = r.stored > 0;
  const harm = r.badData || r.duplicate;

  const nodes: MapNode[] = [
    { id: "user", label: path === "curl" ? "A script" : path === "race" ? "Two people" : "A person", sub: path === "curl" ? "curl -X POST /api/signup" : path === "race" ? 'both pick "newbie"' : "fills in the form", at: [14, 22], mobileAt: [25, 12], state: "active" },
    { id: "browser", label: "Browser", sub: o.browser ? "required, type, pattern" : "novalidate", at: [50, 22], mobileAt: [75, 12], state: path !== "browser" ? "dim" : r.stoppedAt === "browser" ? "bad" : "good" },
    { id: "client", label: "Client schema", sub: o.client ? "instant feedback" : "off", at: [86, 22], mobileAt: [75, 45], state: path !== "browser" || !o.client ? "dim" : r.stoppedAt === "client" ? "bad" : "good" },
    { id: "server", label: "API server", sub: o.server ? "same schema + taken?" : "trusts the input", at: [86, 78], mobileAt: [75, 80], state: !o.server ? "bad" : r.stoppedAt === "server" ? "wait" : "good" },
    { id: "db", label: "Database", sub: o.dbUnique ? "UNIQUE (username)" : "no constraint", at: [50, 78], mobileAt: [25, 80], state: harm ? "bad" : r.stoppedAt === "db" ? "wait" : "good" },
    { id: "result", label: "Result", sub: accepted ? `${r.stored} row${r.stored === 1 ? "" : "s"} stored` : `stopped by ${LAYER_LABEL[r.stoppedAt!]}`, at: [14, 78], mobileAt: [25, 45], state: harm ? "bad" : accepted ? "good" : "wait" },
  ];

  const packets: Packet[] =
    stage === 0 ? hops("t", ["user", "browser"], { label: path === "browser" ? "typing" : "skips the page", tone: path === "browser" ? "accent" : "bad" })
    : stage === 1 ? (path === "browser" ? hops("b", ["browser", "client"], { label: r.stoppedAt === "browser" ? "blocked" : "valid", tone: r.stoppedAt === "browser" ? "bad" : "good" }) : hops("b", ["user", "server"], { label: "POST", tone: "bad" }))
    : stage === 2 ? (path === "browser" && r.stoppedAt !== "browser" ? hops("c", ["client", "server"], { label: r.stoppedAt === "client" ? "errors shown" : "POST", tone: r.stoppedAt === "client" ? "bad" : "accent" }) : [])
    : stage === 3 ? (r.ran.includes("server") || !o.server ? hops("s", ["server", "db"], { label: r.stoppedAt === "server" ? "422" : "INSERT", tone: r.stoppedAt === "server" ? "bad" : o.server ? "good" : "bad" }) : [])
    : stage === 4 ? hops("d", ["db", "result"], { label: r.duplicate ? "2 × newbie" : r.stoppedAt === "db" ? "1 rejected" : accepted ? (r.badData ? "bad row" : "stored") : "nothing", tone: harm ? "bad" : "good" })
    : [];

  const captions = [
    path === "browser" ? `Step 1: typed with errors shown ${TIMINGS.find((t) => t.id === timing)!.label.toLowerCase()}: ${tf.whileTyping} of ${tf.typed.length} keystrokes showed an error while still typing.` : `Step 1: ${PATHS.find((p) => p.id === path)!.what}`,
    path !== "browser" ? "Step 2: the browser's checks never run: the request doesn't come from the page." : o.browser ? (r.stoppedAt === "browser" ? `Step 2: the browser blocked the submit: ${r.errors[0].msg}` : "Step 2: the browser's built-in checks pass.") : "Step 2: the form has novalidate, so the browser checks nothing.",
    path !== "browser" ? "Step 3: the client schema never runs either." : r.stoppedAt === "client" ? `Step 3: the client schema found ${r.errors.length} problem${r.errors.length === 1 ? "" : "s"} and showed them next to the fields.` : o.client ? "Step 3: the client schema passes." : "Step 3: no client schema.",
    !o.server ? "Step 4: the server trusts whatever arrives and inserts it." : r.stoppedAt === "server" ? `Step 4: the server re-ran the checks and answered 422 with ${r.errors.length} error${r.errors.length === 1 ? "" : "s"}.` : "Step 4: the server's checks pass.",
    r.duplicate ? "Step 5: both requests saw the username free and both rows were inserted: two accounts called newbie." : r.stoppedAt === "db" ? "Step 5: the unique index rejected the second insert. One account, and a clear error for the other person." : accepted ? (r.badData ? "Step 5: the row was stored with data the rules don't allow." : "Step 5: one clean row stored.") : "Step 5: nothing reached the database.",
  ];
  const caption = stage !== null ? captions[stage] : accepted ? (harm ? `Accepted, but ${r.duplicate ? "with a duplicate username" : "with invalid data"}.` : "Accepted and stored.") : `Stopped by ${LAYER_LABEL[r.stoppedAt!]}: ${r.errors.length} error${r.errors.length === 1 ? "" : "s"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Frontend · interactive"
        title="Forms and validation"
        blurb="A sign-up form checks its input in the browser, in your client code, on the server and in the database. Only the last two can be trusted: the first two exist to help the person typing. Type into the form, then send it the way a script would."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Input goes from the person through the browser's checks and the client schema to the API server and the database; a script can post straight to the server"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "user", to: "browser", label: "types", dim: path !== "browser" },
                  { from: "browser", to: "client", label: "submit", dim: path !== "browser" },
                  { from: "client", to: "server", label: "POST", dim: path !== "browser" },
                  { from: "user", to: "server", label: "POST", dim: path === "browser" },
                  { from: "server", to: "db", label: "INSERT" },
                  { from: "db", to: "result", label: "rows" },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The sign-up form">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">sign up</p>
                  <span className="flex gap-2 text-xs">
                    <button type="button" onClick={() => setV(MESSY)} className="min-h-11 rounded-md border border-[var(--line)] px-2 text-[var(--muted)]">
                      Messy input
                    </button>
                    <button type="button" onClick={() => setV(VALID)} className="min-h-11 rounded-md border border-[var(--line)] px-2 text-[var(--muted)]">
                      Valid input
                    </button>
                  </span>
                </div>
                <form noValidate onSubmit={(e) => e.preventDefault()} className="mt-2 grid gap-2 sm:grid-cols-2">
                  {FIELDS.map((f) => {
                    const errs = fieldErrors(f.id);
                    const errId = `${ids}-${f.id}-err`;
                    return (
                      <label key={f.id} className="block text-xs">
                        <span className="text-[var(--muted)]">{f.label}</span>
                        <input type={f.type} value={v[f.id]} onChange={(e) => setV((c) => ({ ...c, [f.id]: e.target.value }))} aria-invalid={errs.length > 0} aria-describedby={errs.length ? errId : undefined} autoComplete="off" className="mt-1 h-11 w-full rounded-md border bg-[var(--inset)] px-2 font-mono text-sm" style={{ borderColor: errs.length ? "var(--bad)" : "var(--line)" }} />
                        {errs.length > 0 && (
                          <span id={errId} className="mt-0.5 block text-[11px] text-[var(--bad)]">
                            {errs[0].msg}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </form>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Taken usernames: {TAKEN.join(", ")}. Errors are tied to their field with aria-describedby, so screen readers announce them.</p>
                <p className="mt-2 font-mono text-xs" style={{ color: harm ? "var(--bad)" : accepted ? "var(--good)" : "var(--muted)" }}>
                  {accepted ? `${r.stored} row${r.stored === 1 ? "" : "s"} stored${r.badData ? " · breaks the rules" : ""}${r.duplicate ? " · duplicate username" : ""}` : `stopped by ${LAYER_LABEL[r.stoppedAt!]}`}
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="How it's sent" accent={ACCENT} value={path} onChange={setPath} options={PATHS.map((p) => ({ id: p.id, label: p.label }))} />
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(LOOSE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Checks in the page only
                </button>
                <button type="button" onClick={() => setO(LAYERED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Every layer
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Sending…">
                Sign up
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Decide when to show errors" what="Complaining about an email address while it's still being typed is noise; waiting until submit hides a typo for too long. A common rule: check when the person leaves a field, and once a field shows an error, re-check it on every keystroke so it clears the moment it's fixed." accent={ACCENT} active={at(0)}>
                <Choices accent={ACCENT} value={timing} onChange={setTiming} options={TIMINGS.map((t) => ({ id: t.id, label: t.label }))} />
                <ol className="mt-2 flex flex-wrap gap-0.5" aria-label="Typing an email with a missed dot, leaving the field, then fixing it">
                  {tf.steps.map((s, i) => (
                    <li key={i} title={`${s.event === "blur" ? "leaves the field" : s.text}: ${s.shown ? "error shown" : "no error"}`} className="h-4 w-2.5 rounded-sm" style={{ background: s.event === "blur" ? "var(--text)" : s.shown ? "var(--bad)" : "var(--good)", opacity: s.event === "blur" ? 0.5 : 0.8 }} />
                  ))}
                </ol>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Typing &quot;{tf.typed}&quot;, tabbing away (grey), then fixing it. Error shown while typing: {tf.whileTyping} times · typo caught on leaving: {tf.caughtTypo ? "yes" : "no"} · error still shown after the fix: {tf.staleAfterFix ? "yes" : "no"}
                </p>
              </FlowStep>
              <FlowArrow label="submit" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Let the browser check the basics" what="required, type=email, minlength and pattern give free checks and messages in the person's language. The browser's idea of a valid email is loose: name@example passes." accent={ACCENT} active={at(1)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.browser} onChange={(e) => set({ browser: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Constraint validation (no novalidate)
                </label>
                <CheckList checks={checksFor("browser")} v={v} />
              </FlowStep>
              <FlowArrow label="the values" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Check your own rules in the client" what="A schema in the client gives instant feedback on rules the browser doesn't know: a full domain, a common password, matching passwords. It helps people; it doesn't protect anything." accent={ACCENT} active={at(2)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.client} onChange={(e) => set({ client: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Client-side schema
                </label>
                <CheckList checks={checksFor("client")} v={v} />
              </FlowStep>
              <FlowArrow label="POST /api/signup" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Check everything again on the server" what="Anyone can send a request without the page: curl, a script, a modified client. The server re-runs the same schema, checks what only it can know (is the name taken?), and answers 422 with errors per field." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.server} onChange={(e) => set({ server: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Validate on the server
                </label>
                <CheckList checks={checksFor("server")} v={v} />
              </FlowStep>
              <FlowArrow label="INSERT" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Let the database have the last word" what="Checking that a name is free and then inserting it are two steps. Two sign-ups at the same moment can both pass the check. A unique index makes the database refuse the second one, and the server turns that into a normal error." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.dbUnique} onChange={(e) => set({ dbUnique: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  UNIQUE index on username
                </label>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Every check runs on the values in the form; the email rule is the HTML standard&apos;s definition of a valid email address.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function CheckList({ checks, v }: { checks: typeof CHECKS; v: Values }) {
  return (
    <ul className="mt-1 grid gap-x-3 gap-y-0.5 text-[11px] sm:grid-cols-2">
      {checks.map((c) => {
        const ok = c.ok(v);
        return (
          <li key={`${c.field}-${c.rule}`} style={{ color: ok ? "var(--muted)" : "var(--bad)" }}>
            {ok ? "✓" : "✕"} {c.field}: {c.rule}
          </li>
        );
      })}
    </ul>
  );
}
