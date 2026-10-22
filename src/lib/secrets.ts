// Twelve services use a database password and a payments API key. Where those
// secrets live decides how they leak, how long a leaked one works, and how much work
// rotating it is. Exposure is computed from when the leak happens, when someone
// notices, and how long rotation takes for each design.

export type Store = "code" | "env" | "ci" | "manager" | "dynamic";
export const STORES: { id: Store; label: string; one: string }[] = [
  { id: "code", label: "In the code", one: "const DB_PASSWORD = \"…\" committed to the repository." },
  { id: "env", label: ".env files on servers", one: "A file copied onto each server by hand, outside git." },
  { id: "ci", label: "CI variables", one: "Stored in the CI system and injected at deploy time." },
  { id: "manager", label: "Secrets manager", one: "Fetched at start-up from Vault or a cloud secrets manager, with access per service and an audit log." },
  { id: "dynamic", label: "Dynamic credentials", one: "Each service instance gets its own database user, created on demand and expiring after an hour." },
];

export type LeakId = "public-repo" | "laptop" | "log" | "leaver";
export const LEAKS: { id: LeakId; label: string; reaches: Store[] }[] = [
  { id: "public-repo", label: "The repo is made public by mistake", reaches: ["code"] },
  { id: "laptop", label: "A developer's laptop is stolen", reaches: ["code", "env"] },
  { id: "log", label: "A debug log prints the environment", reaches: ["code", "env", "ci", "manager", "dynamic"] },
  { id: "leaver", label: "An engineer leaves on bad terms", reaches: ["code", "env", "ci"] },
];

export const SERVICES = 12;
export const DETECT_HOURS = 72; // until someone notices
export const SECRET_SCANNING_MINUTES = 5; // push protection or a scanner flags a committed key
export const TTL_DYNAMIC_H = 1;

export type Result = {
  leaked: boolean;
  rotateSteps: string[];
  rotateHours: number;
  redeploys: number;
  exposureHours: number; // how long the leaked secret works
  whoCanRead: string;
  inGitHistory: boolean;
  audit: boolean;
};

export function run(store: Store, leak: LeakId, scanning: boolean): Result {
  const leaked = LEAKS.find((l) => l.id === leak)!.reaches.includes(store);
  const detect = scanning && leak === "public-repo" ? SECRET_SCANNING_MINUTES / 60 : DETECT_HOURS;
  let rotateHours: number;
  let redeploys: number;
  let rotateSteps: string[];
  let whoCanRead: string;
  switch (store) {
    case "code":
      rotateSteps = ["Change the password in the database", `Edit it in the code of ${SERVICES} services`, "Review, merge and redeploy all of them, in step, or they break", "The old value stays in git history forever"];
      rotateHours = 8;
      redeploys = SERVICES;
      whoCanRead = "everyone with the repository, and every fork and clone, forever";
      break;
    case "env":
      rotateSteps = ["Change the password", `Edit the file on every server running the ${SERVICES} services`, "Restart them"];
      rotateHours = 4;
      redeploys = SERVICES;
      whoCanRead = "anyone who can log in to a server, and every backup of it";
      break;
    case "ci":
      rotateSteps = ["Change the password", "Update one CI variable", `Redeploy the ${SERVICES} services to pick it up`];
      rotateHours = 1;
      redeploys = SERVICES;
      whoCanRead = "anyone who can edit a pipeline, which can print it";
      break;
    case "manager":
      rotateSteps = ["The manager rotates it on a schedule or on demand", "Services re-read it on their next refresh; no redeploy"];
      rotateHours = 0.25;
      redeploys = 0;
      whoCanRead = "only the services granted it, each access logged";
      break;
    default:
      rotateSteps = [`Nothing to rotate: every credential expires after ${TTL_DYNAMIC_H} h on its own`, "Revoke the instance's lease to cut it off at once"];
      rotateHours = 0;
      redeploys = 0;
      whoCanRead = "one instance, for one hour";
  }
  const exposureHours = !leaked ? 0 : store === "dynamic" ? Math.min(TTL_DYNAMIC_H, detect) : detect + rotateHours;
  return { leaked, rotateSteps, rotateHours, redeploys, exposureHours, whoCanRead, inGitHistory: store === "code", audit: store === "manager" || store === "dynamic" };
}

export function hours(h: number): string {
  if (h === 0) return "0";
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${Math.round(h * 10) / 10} h`;
}
