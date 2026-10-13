// An index on (country, city, age). Which queries can use it, and how much?
export const ROWS = [
  ["DE", "Berlin", 29], ["DE", "Berlin", 41], ["DE", "Munich", 35], ["PK", "Karachi", 22], ["PK", "Karachi", 38],
  ["PK", "Lahore", 19], ["PK", "Lahore", 27], ["PK", "Lahore", 33], ["PK", "Lahore", 45], ["UK", "Leeds", 31], ["UK", "London", 26], ["UK", "London", 52],
].map(([country, city, age], i) => ({ id: i, country: country as string, city: city as string, age: age as number }));
export type Q = "c" | "cc" | "cca" | "ca" | "city";
export const QUERIES: { id: Q; sql: string }[] = [
  { id: "c", sql: "country = 'PK'" },
  { id: "cc", sql: "country = 'PK' AND city = 'Lahore'" },
  { id: "cca", sql: "country = 'PK' AND city = 'Lahore' AND age > 30" },
  { id: "ca", sql: "country = 'PK' AND age > 30" },
  { id: "city", sql: "city = 'Lahore'" },
];
export function plan(q: Q) {
  const match = (r: (typeof ROWS)[number]) =>
    (q === "city" || r.country === "PK") && (q === "c" || q === "ca" ? true : r.city === "Lahore") && (q === "cca" || q === "ca" ? r.age > 30 : true);
  const hits = ROWS.filter(match).map((r) => r.id);
  if (q === "city") return { used: "none", scanned: ROWS.map((r) => r.id), hits, text: "city is the second column. Without country, matching rows are spread all over the index, so it does a full scan." };
  const prefix = q === "c" || q === "ca" ? ROWS.filter((r) => r.country === "PK") : ROWS.filter((r) => r.country === "PK" && r.city === "Lahore");
  const scanned = q === "cca" ? prefix.filter((r) => r.age > 30).map((r) => r.id) : prefix.map((r) => r.id);
  const used = q === "c" ? "country" : q === "ca" ? "country (age filtered after)" : q === "cc" ? "country, city" : "country, city, age";
  const text = q === "ca" ? "It can seek to PK, but city sits between country and age, so ages aren't in order there. It reads every PK entry and filters." : q === "cca" ? "All three columns: seek to PK/Lahore and then straight to age > 30. Reads only the matching entries." : "Equality on the leading column(s): one seek to a contiguous slice of the index.";
  return { used, scanned, hits, text };
}
