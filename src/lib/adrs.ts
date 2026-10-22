// A decision made today, and the team that has to live with it. People leave at a
// yearly rate; the ones who were in the room take the reasons with them unless the
// reasons were written down. Who still knows why is arithmetic. What newcomers do
// about a decision they don't understand uses illustrative rates, and the page says so.

export type DecisionId = "postgres" | "monolith" | "graphql";

export type Decision = {
  id: DecisionId;
  title: string;
  context: string;
  options: { name: string; why: string; chosen?: boolean }[];
  decision: string;
  consequences: { good: boolean; text: string }[];
  constraint: string; // the fact the decision rests on
  changed: string; // what it looks like when that fact stops being true
  superseded: string; // the follow-up ADR when it does
};

export const DECISIONS: Decision[] = [
  {
    id: "postgres",
    title: "ADR-007: Store the ledger in PostgreSQL",
    context: "Every payment writes a debit and a credit that must commit together. Finance reconciles daily with SQL.",
    options: [
      { name: "PostgreSQL", why: "Multi-row transactions; the finance team already writes SQL.", chosen: true },
      { name: "MongoDB", why: "Flexible documents; multi-document transactions are newer and slower." },
      { name: "DynamoDB", why: "Scales without tuning; transactions limited to 100 items, no ad-hoc SQL." },
    ],
    decision: "Use PostgreSQL for the ledger, with both entries in one transaction.",
    consequences: [
      { good: true, text: "A payment can never be half-written." },
      { good: false, text: "We run and tune a database server ourselves." },
      { good: false, text: "Writes top out at one primary; revisit past ~5,000 payments a second." },
    ],
    constraint: "both entries must commit together",
    changed: "The ledger moved to a dedicated accounting service with its own store.",
    superseded: "ADR-031: Ledger owned by the accounting service (supersedes ADR-007).",
  },
  {
    id: "monolith",
    title: "ADR-002: Start as a modular monolith",
    context: "Four engineers, one product, requirements still moving weekly.",
    options: [
      { name: "Modular monolith", why: "One deploy; modules with enforced interfaces we can split later.", chosen: true },
      { name: "Microservices", why: "Independent deploys; a network, a pipeline and an on-call per service." },
    ],
    decision: "One deployable, with module boundaries enforced by the build.",
    consequences: [
      { good: true, text: "One pipeline, one log, one stack trace." },
      { good: true, text: "Renaming a concept is one pull request." },
      { good: false, text: "Revisit when deploy queues pass ~30 minutes or teams pass ~6." },
    ],
    constraint: "a small team shipping one product",
    changed: "The company is now nine teams and deploys wait in a release train.",
    superseded: "ADR-024: Split payments and search into services (supersedes ADR-002 in part).",
  },
  {
    id: "graphql",
    title: "ADR-012: A GraphQL API for the mobile apps",
    context: "iOS, Android and web each need different fields for the same screens; mobile users are on slow networks.",
    options: [
      { name: "GraphQL", why: "Each client asks for exactly its fields, in one round trip.", chosen: true },
      { name: "REST + backend-for-frontend", why: "A small API per client; three codebases to keep." },
      { name: "REST as it is", why: "Over-fetching; 4–6 requests per screen." },
    ],
    decision: "Expose a GraphQL gateway for client apps; services keep REST internally.",
    consequences: [
      { good: true, text: "One request per screen." },
      { good: false, text: "Query cost needs limits; HTTP caching by URL no longer works." },
    ],
    constraint: "three clients with different needs on slow networks",
    changed: "The apps were retired; one web client remains, rendered on the server.",
    superseded: "ADR-040: Retire the GraphQL gateway (supersedes ADR-012).",
  },
];

export const TEAM = 10;
export const TURNOVERS = [0.1, 0.2, 0.35];
export const IN_THE_ROOM = 4; // people who made the decision
// Illustrative behaviour of a newcomer who meets a decision they find odd.
export const PROPOSE_NO_RECORD = 0.35; // proposes undoing it
export const PROPOSE_WITH_RECORD = 0.08; // proposes undoing it after reading the ADR
export const DEBATE_HOURS = 6; // three people, two hours
export const WRONG_REVERSAL_NO_RECORD = 0.4; // a debate without the original reasons reverses a decision that still holds
export const WRONG_REVERSAL_WITH_RECORD = 0.05;

export type Result = {
  originalsLeft: number; // of the people in the room, still here
  teamOriginal: number; // team members who were there at the decision
  newcomers: number;
  knowWhy: number; // people who can give the reasons
  debates: number;
  hours: number;
  wrongReversalChance: number; // chance at least one debate reverses a decision whose reason still holds
  action: string;
};

export function run(months: number, turnover: number, recorded: boolean, constraintHolds: boolean): Result {
  const keep = Math.pow(1 - turnover, months / 12);
  const originalsLeft = IN_THE_ROOM * keep;
  const teamOriginal = TEAM * keep;
  const newcomers = TEAM - teamOriginal;
  const knowWhy = recorded ? TEAM : originalsLeft;
  const proposeRate = recorded ? PROPOSE_WITH_RECORD : PROPOSE_NO_RECORD;
  const debates = constraintHolds ? newcomers * proposeRate : 0;
  const wrong = recorded ? WRONG_REVERSAL_WITH_RECORD : WRONG_REVERSAL_NO_RECORD;
  const wrongReversalChance = constraintHolds ? 1 - Math.pow(1 - wrong, debates) : 0;
  const action = constraintHolds
    ? recorded
      ? "The reason still holds. A newcomer reads the ADR, sees why, and moves on."
      : `The reason still holds, but ${originalsLeft < 1 ? "nobody who made the call is left" : `only ${originalsLeft.toFixed(1)} of the ${IN_THE_ROOM} people who made the call remain`}. Each newcomer who finds it odd starts the debate again from scratch.`
    : recorded
      ? "The fact the decision rested on is gone, and the ADR says which fact that was. Write a new ADR that supersedes it; the old one stays, marked superseded, so the history is readable."
      : "The fact the decision rested on is gone, but nobody wrote down which fact that was. Is it safe to change? The team has to rediscover the original reasons before it can tell.";
  return { originalsLeft, teamOriginal, newcomers, knowWhy, debates, hours: debates * DEBATE_HOURS, wrongReversalChance, action };
}

export function retentionCurve(turnover: number, recorded: boolean): { month: number; know: number }[] {
  return Array.from({ length: 37 }, (_, m) => ({ month: m, know: recorded ? TEAM : IN_THE_ROOM * Math.pow(1 - turnover, m / 12) }));
}
