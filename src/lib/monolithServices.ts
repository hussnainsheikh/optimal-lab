// One checkout request touches five modules: cart, pricing, inventory, payment and
// orders. Build them as a monolith, a modular monolith, or five services, and grow
// the organisation from 2 teams to 20. Request cost, availability, deploy waiting and
// cross-team changes are computed from the numbers below.

export type Arch = "monolith" | "modular" | "services";

export const ARCHES: { id: Arch; label: string; one: string }[] = [
  { id: "monolith", label: "Monolith", one: "One codebase, one deploy, modules call each other freely." },
  { id: "modular", label: "Modular monolith", one: "One deploy, but each module has a public interface and the build forbids reaching past it." },
  { id: "services", label: "Microservices", one: "Each module is its own service, with its own database, pipeline and on-call." },
];

export const MODULES = ["cart", "pricing", "inventory", "payment", "orders"];
export const TEAMS = [2, 6, 20];
export const CALLS_PER_REQUEST = MODULES.length; // one call into each module
export const IN_PROCESS_MS = 0.05;
export const NETWORK_MS = 2.5; // p50 per call, including serialisation
export const NETWORK_P99_MS = 25; // one slow hop in a hundred
export const UNIT_AVAILABILITY = 0.9995; // one deployable, with replicas
export const CHANGES_PER_TEAM_PER_DAY = 2;
export const DEPLOY_MIN = 30; // build, test and roll out one deploy
export const WORKDAY_MIN = 8 * 60;
export const CROSS_TEAM = { monolith: 0.3, modular: 0.08, services: 0.08 } as const; // share of changes that touch another team's code
export const ENGINEERS_PER_TEAM = 7;

export type Result = {
  deployables: number;
  overheadMs: number; // extra time per request from calls between modules
  slowShare: number; // requests that hit at least one slow hop
  availability: number;
  pipelineLoad: number; // share of the working day one pipeline is busy
  deployWaitMin: number | null; // null: more deploys than the day holds; changes ship in a daily release train
  crossTeamPerWeek: number;
  coordinatedDeploysPerWeek: number; // cross-team changes that need two services released in order
  onCallRotations: number;
};

export function run(arch: Arch, teams: number): Result {
  const deployables = arch === "services" ? Math.max(MODULES.length, teams) : 1;
  const hops = arch === "services" ? CALLS_PER_REQUEST : 0;
  const overheadMs = arch === "services" ? hops * NETWORK_MS : CALLS_PER_REQUEST * IN_PROCESS_MS;
  const slowShare = 1 - Math.pow(0.99, hops);
  const availability = Math.pow(UNIT_AVAILABILITY, arch === "services" ? CALLS_PER_REQUEST : 1);

  // One pipeline shared by every team, or one per service.
  const teamsPerPipeline = arch === "services" ? teams / deployables : teams;
  const pipelineLoad = (teamsPerPipeline * CHANGES_PER_TEAM_PER_DAY * DEPLOY_MIN) / WORKDAY_MIN;
  // M/D/1 queue: average wait = ρ / (2(1 − ρ)) × service time.
  const deployWaitMin = pipelineLoad >= 1 ? null : (pipelineLoad / (2 * (1 - pipelineLoad))) * DEPLOY_MIN;

  const changesPerWeek = teams * CHANGES_PER_TEAM_PER_DAY * 5;
  const crossTeamPerWeek = changesPerWeek * CROSS_TEAM[arch];
  const coordinatedDeploysPerWeek = arch === "services" ? crossTeamPerWeek : 0;
  const onCallRotations = arch === "services" ? Math.min(deployables, teams) : 1;

  return { deployables, overheadMs, slowShare, availability, pipelineLoad, deployWaitMin, crossTeamPerWeek, coordinatedDeploysPerWeek, onCallRotations };
}

export function minutes(m: number | null): string {
  if (m === null) return "next day's train";
  return m < 1 ? "< 1 min" : `${Math.round(m)} min`;
}

export function pct(v: number, digits = 2): string {
  return `${(v * 100).toFixed(digits)}%`;
}
