// At 14:00 a deploy breaks checkout for 30% of customers. How long it lasts depends
// on how the team works: what pages someone, who coordinates, whether rolling back
// is one command, and whether customers are told. Each phase's length comes from
// the practices chosen; failed checkouts and support tickets follow from the times.

export type Practices = { symptomAlert: boolean; paging: boolean; commander: boolean; rollback: boolean; statusPage: boolean };
export const NONE: Practices = { symptomAlert: false, paging: false, commander: false, rollback: false, statusPage: false };
export const ALL: Practices = { symptomAlert: true, paging: true, commander: true, rollback: true, statusPage: true };

export const START_CLOCK = 14 * 60; // 14:00
export const CHECKOUTS_PER_MIN = 400;
export const ERROR_SHARE = 0.3;
export const AVG_ORDER = 42; // $
export const TICKETS_PER_MIN = 6; // support tickets a minute while customers are left guessing
export const TICKETS_PER_MIN_INFORMED = 1;

export const PRACTICES: { id: keyof Practices; label: string; on: string; off: string }[] = [
  { id: "symptomAlert", label: "Alert on what users feel", on: "An alert on checkout error rate fires in 3 minutes.", off: "Alerts watch CPU and memory, which look fine; the first sign is a customer ticket after 25 minutes." },
  { id: "paging", label: "Page an on-call engineer", on: "One person is paged and acknowledges in 4 minutes.", off: "The alert goes to a team channel; someone notices in 20 minutes." },
  { id: "commander", label: "Name an incident commander", on: "One person coordinates: who investigates what, who talks to whom. Diagnosis takes 12 minutes.", off: "Five people debug the same thing in the same channel; it takes 30 minutes to agree on the cause." },
  { id: "rollback", label: "Roll back in one command", on: "The previous version is redeployed in 5 minutes.", off: "Rolling back needs a database change undone by hand; a fix forward takes 35 minutes." },
  { id: "statusPage", label: "Update a status page", on: "Customers are told within 5 minutes of the page, and every 15 after.", off: "Customers find out by failing, and write to support." },
];

export type Phase = { id: "detect" | "ack" | "diagnose" | "mitigate"; label: string; start: number; end: number; who: string };
export type Result = {
  phases: Phase[];
  detectMin: number;
  ackMin: number;
  diagnoseMin: number;
  mitigateMin: number;
  totalMin: number;
  failed: number;
  revenue: number;
  tickets: number;
  actions: string[];
};

export function run(p: Practices): Result {
  const detectMin = p.symptomAlert ? 3 : 25;
  const ackMin = p.paging ? 4 : 20;
  const diagnoseMin = p.commander ? 12 : 30;
  const mitigateMin = p.rollback ? 5 : 35;
  const totalMin = detectMin + ackMin + diagnoseMin + mitigateMin;
  let t = 0;
  const phase = (id: Phase["id"], label: string, d: number, who: string): Phase => {
    const ph = { id, label, start: t, end: t + d, who };
    t += d;
    return ph;
  };
  const phases = [
    phase("detect", "Detect", detectMin, p.symptomAlert ? "error-rate alert" : "a customer ticket"),
    phase("ack", "Acknowledge", ackMin, p.paging ? "on-call engineer" : "whoever reads the channel"),
    phase("diagnose", "Diagnose", diagnoseMin, p.commander ? "investigators, coordinated by the commander" : "everyone at once"),
    phase("mitigate", "Mitigate", mitigateMin, p.rollback ? "rollback" : "a fix forward"),
  ];
  const failed = totalMin * CHECKOUTS_PER_MIN * ERROR_SHARE;
  const informedFrom = p.statusPage ? detectMin + ackMin + 5 : Infinity;
  const tickets = Math.round(Math.min(totalMin, informedFrom) * TICKETS_PER_MIN + Math.max(0, totalMin - informedFrom) * TICKETS_PER_MIN_INFORMED);
  const actions: string[] = PRACTICES.filter((x) => !p[x.id]).map((x): string => {
    switch (x.id) {
      case "symptomAlert":
        return "Add an alert on checkout error rate and latency, owned by the checkout team.";
      case "paging":
        return "Route that alert to a paging rotation with acknowledgement.";
      case "commander":
        return "Agree that the first responder names an incident commander in the first five minutes.";
      case "rollback":
        return "Make database migrations backward compatible so every deploy can be rolled back in one command.";
      default:
        return "Publish a status page and a template for the first update.";
    }
  });
  actions.push("Add a test for the code path that broke, and a canary step that would have caught 30% errors.");
  return { phases, detectMin, ackMin, diagnoseMin, mitigateMin, totalMin, failed, revenue: failed * AVG_ORDER, tickets, actions };
}

export function clock(minAfter: number): string {
  const m = START_CLOCK + minAfter;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
}
