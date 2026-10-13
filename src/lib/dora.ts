// The four DORA metrics and their bands (from the State of DevOps research). Simplified thresholds.
export type Band = "Elite" | "High" | "Medium" | "Low";
export const deployBand = (perWeek: number): Band => (perWeek >= 7 ? "Elite" : perWeek >= 1 ? "High" : perWeek >= 0.25 ? "Medium" : "Low");
export const leadBand = (hours: number): Band => (hours <= 24 ? "Elite" : hours <= 168 ? "High" : hours <= 720 ? "Medium" : "Low");
export const failBand = (pct: number): Band => (pct <= 5 ? "Elite" : pct <= 15 ? "High" : pct <= 30 ? "Medium" : "Low");
export const restoreBand = (hours: number): Band => (hours <= 1 ? "Elite" : hours <= 24 ? "High" : hours <= 168 ? "Medium" : "Low");
export const PRESETS = {
  quarterly: { deploys: 0.1, lead: 1400, fail: 35, restore: 72, label: "Quarterly releases" },
  weekly: { deploys: 1, lead: 120, fail: 15, restore: 8, label: "Weekly releases" },
  continuous: { deploys: 20, lead: 6, fail: 4, restore: 0.5, label: "Continuous delivery" },
};
