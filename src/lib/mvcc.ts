// MVCC (multi-version concurrency control), Postgres style. An UPDATE doesn't overwrite a row:
// it writes a new version. Each version records which transaction created it (xmin) and which
// replaced it (xmax). A transaction sees the versions that were committed when it started.

export type Version = { value: number; xmin: number; xmax: number | null; committed: boolean };
export type MvccFrame = { text: string; versions: Version[]; reader: { tx: number; sees: number | null } | null };

export function runMvcc(): MvccFrame[] {
  const v: Version[] = [{ value: 50, xmin: 90, xmax: null, committed: true }];
  const f: MvccFrame[] = [];
  const snap = () => v.map((x) => ({ ...x }));
  f.push({ text: "The row: balance = 50, created by transaction 90.", versions: snap(), reader: null });
  f.push({ text: "T100 starts. Its snapshot: everything committed so far.", versions: snap(), reader: { tx: 100, sees: 50 } });
  v[0].xmax = 101;
  v.push({ value: 80, xmin: 101, xmax: null, committed: false });
  f.push({ text: "T101 updates balance to 80. A new version appears; the old one is marked replaced by 101. Nobody waits.", versions: snap(), reader: { tx: 100, sees: 50 } });
  v[1].committed = true;
  f.push({ text: "T101 commits.", versions: snap(), reader: { tx: 100, sees: 50 } });
  f.push({ text: "T100 reads again: still 50. T101 committed after T100's snapshot, so T100 keeps seeing the old version.", versions: snap(), reader: { tx: 100, sees: 50 } });
  f.push({ text: "T102 starts after the commit and reads 80.", versions: snap(), reader: { tx: 102, sees: 80 } });
  f.push({ text: "T100 finishes. No running transaction needs the old version, so VACUUM can remove it.", versions: snap().filter((x) => x.xmax === null), reader: null });
  return f;
}
