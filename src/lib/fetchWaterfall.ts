// A profile page needs: the user, their posts (needs user id), comments (needs post ids) and a sidebar (independent).
export type Mode = "waterfall" | "parallel" | "server";
export const MODES: { id: Mode; label: string }[] = [
  { id: "waterfall", label: "Each component fetches in an effect" },
  { id: "parallel", label: "Start independent requests together" },
  { id: "server", label: "Fetch on the server, near the database" },
];
export function bars(m: Mode) {
  const RTT = m === "server" ? 2 : 120, Q = 30, RENDER = m === "waterfall" ? 40 : 0;
  const req = (start: number) => ({ start, end: start + RTT + Q });
  if (m === "waterfall") {
    const user = req(RENDER);
    const posts = req(user.end + RENDER);
    const comments = req(posts.end + RENDER);
    const sidebar = req(user.end + RENDER);
    return { rows: [{ name: "user", ...user }, { name: "posts", ...posts }, { name: "comments", ...comments }, { name: "sidebar", ...sidebar }], done: comments.end + RENDER };
  }
  const user = req(0), sidebar = req(0);
  const posts = req(user.end), comments = req(posts.end);
  const extra = m === "server" ? 150 : 0; // one round trip to deliver the HTML
  return { rows: [{ name: "user", ...user }, { name: "posts", ...posts }, { name: "comments", ...comments }, { name: "sidebar", ...sidebar }], done: comments.end + extra };
}
