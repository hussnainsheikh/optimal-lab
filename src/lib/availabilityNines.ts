// Availability of a chain of components, with redundancy.
export const PARTS = { lb: 0.9999, app: 0.999, db: 0.9995 };
export const par = (a: number, n: number) => 1 - (1 - a) ** n;
export function system(apps: number, dbs: number) {
  const app = par(PARTS.app, apps), db = par(PARTS.db, dbs);
  const total = PARTS.lb * app * db;
  return { app, db, total, downMinYear: (1 - total) * 525600, downMinMonth: (1 - total) * 43800 };
}
export const nines = (a: number) => -Math.log10(1 - a);
