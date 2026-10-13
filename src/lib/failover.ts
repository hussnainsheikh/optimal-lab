// Disaster recovery strategies when a whole region goes down. Figures are typical, illustrative.
export const STRATS = [
  { id: "backup", label: "Backup and restore", rtoMin: 480, rpoMin: 1440, cost: 1.1, steps: ["Notice the outage", "Create infrastructure in a new region", "Restore the last nightly backup", "Point DNS at the new region"] },
  { id: "pilot", label: "Pilot light", rtoMin: 60, rpoMin: 5, cost: 1.2, steps: ["Notice the outage", "Promote the replicated database", "Start app servers from images", "Switch DNS"] },
  { id: "warm", label: "Warm standby", rtoMin: 15, rpoMin: 1, cost: 1.5, steps: ["Health checks fail", "Promote the standby database", "Scale up the small running fleet", "DNS fails over"] },
  { id: "active", label: "Active-active", rtoMin: 1, rpoMin: 0, cost: 2.1, steps: ["Health checks fail", "Traffic shifts to the healthy region automatically"] },
] as const;
export type StratId = (typeof STRATS)[number]["id"];
