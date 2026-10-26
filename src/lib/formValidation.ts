// A sign-up form checked in four places: the browser's built-in constraint validation, a
// schema in the client, the same schema again on the server, and a unique index in the
// database. The email check is the HTML standard's own definition of a valid email address;
// the rest are ordinary rules. Each check really runs on what the reader typed.

export type Values = { email: string; username: string; password: string; confirm: string };
export type Field = keyof Values;
export type Layer = "browser" | "client" | "server" | "db";

// WHATWG HTML: "valid email address" (what <input type=email> accepts).
export const HTML_EMAIL = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
export const USERNAME = /^[a-z0-9_]{3,20}$/;
export const TAKEN = ["sam", "alex_99", "admin", "support"];
export const COMMON = ["password1234", "123456789012", "qwertyuiop12", "iloveyou1234"];

export type Check = { field: Field; layer: Layer; rule: string; ok: (v: Values) => boolean; msg: string };

const schema = (layer: "client" | "server"): Check[] => [
  { field: "email", layer, rule: "domain has a dot", ok: (v) => /@[^@]+\.[^@]+$/.test(v.email), msg: "Use an email with a full domain, like name@example.com." },
  { field: "username", layer, rule: "not reserved", ok: (v) => !["admin", "support", "root"].includes(v.username.toLowerCase()), msg: "That name is reserved." },
  { field: "password", layer, rule: "not a common password", ok: (v) => !COMMON.includes(v.password.toLowerCase()), msg: "That password is on every attacker's list." },
  { field: "confirm", layer, rule: "matches the password", ok: (v) => v.confirm === v.password, msg: "The passwords don't match." },
];

export const CHECKS: Check[] = [
  { field: "email", layer: "browser", rule: "required", ok: (v) => v.email.length > 0, msg: "Please fill out this field." },
  { field: "email", layer: "browser", rule: "type=email", ok: (v) => !v.email || HTML_EMAIL.test(v.email), msg: "Please include a valid email address." },
  { field: "username", layer: "browser", rule: "required", ok: (v) => v.username.length > 0, msg: "Please fill out this field." },
  { field: "username", layer: "browser", rule: "pattern=[a-z0-9_]{3,20}", ok: (v) => !v.username || USERNAME.test(v.username), msg: "Please match the requested format." },
  { field: "password", layer: "browser", rule: "minlength=12", ok: (v) => !v.password || v.password.length >= 12, msg: "Use at least 12 characters." },
  { field: "password", layer: "browser", rule: "required", ok: (v) => v.password.length > 0, msg: "Please fill out this field." },
  ...schema("client"),
  ...schema("server"),
  // The server's own rules also re-check what the browser checked: requests can skip the browser.
  { field: "email", layer: "server", rule: "valid email", ok: (v) => HTML_EMAIL.test(v.email), msg: "Invalid email." },
  { field: "username", layer: "server", rule: "valid username", ok: (v) => USERNAME.test(v.username), msg: "Invalid username." },
  { field: "password", layer: "server", rule: "at least 12 characters", ok: (v) => v.password.length >= 12, msg: "Password too short." },
  { field: "username", layer: "server", rule: "not taken (SELECT)", ok: (v) => !TAKEN.includes(v.username.toLowerCase()), msg: "That username is taken." },
];

export type Opts = { browser: boolean; client: boolean; server: boolean; dbUnique: boolean };
export const LOOSE: Opts = { browser: true, client: true, server: false, dbUnique: false };
export const LAYERED: Opts = { browser: true, client: true, server: true, dbUnique: true };

export type Path = "browser" | "curl" | "race";
export const PATHS: { id: Path; label: string; what: string }[] = [
  { id: "browser", label: "Submit the form", what: "A person fills in the form and presses Sign up." },
  { id: "curl", label: "POST with curl", what: "A script posts the same fields straight to /api/signup, skipping the page." },
  { id: "race", label: "Two sign-ups at once", what: "Two people pick the same new username within the same few milliseconds." },
];

export type Outcome = { stoppedAt: Layer | null; errors: Check[]; ran: Layer[]; stored: number; badData: boolean; duplicate: boolean };

export function submit(v: Values, o: Opts, path: Path): Outcome {
  const ran: Layer[] = [];
  const layers: Layer[] = path === "browser" ? ["browser", "client", "server"] : ["server"];
  for (const layer of layers) {
    const on = layer === "browser" ? o.browser : layer === "client" ? o.client : o.server;
    if (!on) continue;
    ran.push(layer);
    const failed = CHECKS.filter((c) => c.layer === layer && !(path === "curl" && c.field === "confirm") && !c.ok(v));
    if (failed.length) return { stoppedAt: layer, errors: failed, ran, stored: 0, badData: false, duplicate: false };
  }
  // Passed every layer that ran. Did anything bad get through?
  const shouldFail = CHECKS.filter((c) => c.layer === "server" && !(path === "curl" && c.field === "confirm") && !c.ok(v));
  if (path === "race") {
    // Both requests SELECT before either INSERTs, so both see the name as free.
    ran.push("db");
    if (o.dbUnique) return { stoppedAt: "db", errors: [{ field: "username", layer: "db", rule: "UNIQUE (username)", ok: () => false, msg: "duplicate key value violates unique constraint \"users_username_key\"" }], ran, stored: 1, badData: shouldFail.length > 0, duplicate: false };
    return { stoppedAt: null, errors: [], ran, stored: 2, badData: shouldFail.length > 0, duplicate: true };
  }
  ran.push("db");
  return { stoppedAt: null, errors: [], ran, stored: 1, badData: shouldFail.length > 0, duplicate: false };
}

// --- when to show errors while typing ----------------------------------------------------

export type Timing = "keystroke" | "blur" | "submit" | "late";
export const TIMINGS: { id: Timing; label: string; what: string }[] = [
  { id: "keystroke", label: "Every keystroke", what: "Errors appear as soon as the field is wrong, even mid-word." },
  { id: "blur", label: "On leaving the field", what: "Checked when focus leaves the field." },
  { id: "submit", label: "Only on submit", what: "Nothing until Sign up is pressed." },
  { id: "late", label: "Blur, then live", what: "Checked on blur; once a field shows an error, it's re-checked on every keystroke so it clears as soon as it's fixed." },
];

/** Type `target` into the email field with a typo, tab away, then go back and fix it. */
export function typingFeedback(target: string, timing: Timing) {
  const steps: { text: string; event: "key" | "blur"; shown: boolean }[] = [];
  let touched = false;
  let showing = false;
  const valid = (s: string) => HTML_EMAIL.test(s) && /@[^@]+\.[^@]+$/.test(s);
  const typed = target.replace(".com", "com"); // a missed dot, noticed after leaving the field
  const keys = [...typed].map((_, i) => typed.slice(0, i + 1));
  const stem = typed.slice(0, -3);
  const fix = [typed.slice(0, -1), typed.slice(0, -2), stem, stem + ".", stem + ".c", stem + ".co", stem + ".com"];
  const run = (text: string, event: "key" | "blur") => {
    const bad = !valid(text);
    if (timing === "keystroke") showing = bad;
    if (timing === "blur" && event === "blur") showing = bad;
    // In blur mode a shown error stays, even once fixed, until the field is left again.
    if (timing === "late") {
      if (event === "blur") {
        touched = true;
        showing = bad;
      } else if (touched || showing) showing = bad;
    }
    steps.push({ text, event, shown: showing });
  };
  keys.forEach((k) => run(k, "key"));
  run(typed, "blur");
  fix.forEach((k) => run(k, "key"));
  const whileTyping = steps.slice(0, keys.length).filter((s) => s.shown).length;
  const afterFix = steps[steps.length - 1].shown;
  const caughtTypo = steps[keys.length].shown;
  return { steps, whileTyping, caughtTypo, staleAfterFix: afterFix, typed };
}
