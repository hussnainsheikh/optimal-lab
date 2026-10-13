// Tabbing through a page that opens a dialog. Which elements get focus, in order?
export const FIXES = [
  { id: "button", label: "Use <button>, not <div onclick>" },
  { id: "outline", label: "Keep a visible focus outline" },
  { id: "trap", label: "Trap focus inside the open dialog" },
  { id: "restore", label: "Return focus to the opener on close" },
];
export function stops(on: Set<string>) {
  const page = ["Skip to content", "Search", on.has("button") ? "Open filters (button)" : null, "Product 1", "Product 2"].filter(Boolean) as string[];
  const dialog = ["Close ✕", "Price slider", "Apply"];
  const seq: { label: string; where: "page" | "dialog" | "behind"; note?: string }[] = [];
  page.slice(0, 3).forEach((l) => seq.push({ label: l, where: "page" }));
  if (!on.has("button")) seq.push({ label: "(can't reach Open filters: a div isn't focusable)", where: "page", note: "bad" });
  seq.push({ label: "— dialog opens —", where: "dialog" });
  dialog.forEach((l) => seq.push({ label: l, where: "dialog" }));
  if (on.has("trap")) seq.push({ label: "Close ✕ (wraps around)", where: "dialog" });
  else { seq.push({ label: "Product 1 (behind the dialog!)", where: "behind", note: "bad" }); }
  seq.push({ label: "— dialog closes —", where: "page" });
  seq.push(on.has("restore") ? { label: "Open filters (focus restored)", where: "page" } : { label: "<body> (focus lost: start over)", where: "page", note: "bad" });
  return seq;
}
