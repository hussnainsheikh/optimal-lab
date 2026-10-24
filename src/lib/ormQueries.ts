// What an ORM sends for one page: 20 blog posts with their author, tags and comment count.
// The data is generated (50 authors, 2,000 posts, 0–40 comments and 1–4 tags each); for each
// loading strategy the actual SQL statements are produced, and the rows they would return are
// counted from the data, including the row explosion when two one-to-many relations are joined
// in one query. Round-trip time and per-row cost are illustrative.

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Post = { id: number; authorId: number; tags: number; comments: number };
let cache: Post[] | null = null;
export function posts(): Post[] {
  if (cache) return cache;
  const r = rng(77);
  return (cache = Array.from({ length: 2_000 }, (_, i) => ({ id: i + 1, authorId: 1 + Math.floor(r() * 50), tags: 1 + Math.floor(r() * 4), comments: Math.floor(Math.pow(r(), 2) * 41) })));
}
export const PAGE = 20;
/** The newest 20 posts. */
export const page = () => posts().slice(-PAGE).reverse();

export type Strategy = "lazy" | "joined" | "selectin";
export type Count = "load" | "aggregate";
export const ROW_B = { post: 900, postNarrow: 160, author: 120, tag: 40, comment: 400, count: 16 }; // bytes per row returned

export type Stmt = { sql: string; rows: number; bytes: number };

export function plan(strategy: Strategy, count: Count, narrow: boolean): Stmt[] {
  const ps = page();
  const ids = ps.map((p) => p.id).join(", ");
  const authorIds = [...new Set(ps.map((p) => p.authorId))];
  const cols = narrow ? "p.id, p.title, p.author_id, p.created_at" : "p.*";
  const postB = narrow ? ROW_B.postNarrow : ROW_B.post;
  const list: Stmt = { sql: `SELECT ${cols} FROM posts p ORDER BY p.created_at DESC LIMIT ${PAGE}`, rows: PAGE, bytes: PAGE * postB };
  if (strategy === "lazy") {
    // Each template access to post.author / post.tags / post.comments fires its own query.
    const out = [list];
    for (const p of ps) out.push({ sql: `SELECT * FROM authors WHERE id = ${p.authorId}`, rows: 1, bytes: ROW_B.author });
    for (const p of ps) out.push({ sql: `SELECT t.* FROM tags t JOIN post_tags pt ON pt.tag_id = t.id WHERE pt.post_id = ${p.id}`, rows: p.tags, bytes: p.tags * ROW_B.tag });
    for (const p of ps)
      out.push(
        count === "load"
          ? { sql: `SELECT * FROM comments WHERE post_id = ${p.id}`, rows: p.comments, bytes: p.comments * ROW_B.comment }
          : { sql: `SELECT count(*) FROM comments WHERE post_id = ${p.id}`, rows: 1, bytes: ROW_B.count },
      );
    return out;
  }
  if (strategy === "joined") {
    // One query joining both one-to-many relations: every tag row pairs with every comment row.
    const rows = ps.reduce((a, p) => a + p.tags * (count === "load" ? Math.max(1, p.comments) : 1), 0);
    const width = postB + ROW_B.author + ROW_B.tag + (count === "load" ? ROW_B.comment : ROW_B.count);
    return [
      {
        sql:
          count === "load"
            ? `SELECT ${cols}, a.*, t.*, c.* FROM posts p JOIN authors a ON a.id = p.author_id LEFT JOIN post_tags pt ON pt.post_id = p.id LEFT JOIN tags t ON t.id = pt.tag_id LEFT JOIN comments c ON c.post_id = p.id ORDER BY p.created_at DESC`
            : `SELECT ${cols}, a.*, t.*, (SELECT count(*) FROM comments c WHERE c.post_id = p.id) AS comments FROM posts p JOIN authors a ON a.id = p.author_id LEFT JOIN post_tags pt ON pt.post_id = p.id LEFT JOIN tags t ON t.id = pt.tag_id ORDER BY p.created_at DESC`,
        rows,
        bytes: rows * width,
      },
    ];
  }
  // select-in: one query per relation, with the ids from the first.
  const tagRows = ps.reduce((a, p) => a + p.tags, 0);
  const commentRows = ps.reduce((a, p) => a + p.comments, 0);
  return [
    list,
    { sql: `SELECT * FROM authors WHERE id IN (${authorIds.join(", ")})`, rows: authorIds.length, bytes: authorIds.length * ROW_B.author },
    { sql: `SELECT pt.post_id, t.* FROM tags t JOIN post_tags pt ON pt.tag_id = t.id WHERE pt.post_id IN (${ids})`, rows: tagRows, bytes: tagRows * ROW_B.tag },
    count === "load"
      ? { sql: `SELECT * FROM comments WHERE post_id IN (${ids})`, rows: commentRows, bytes: commentRows * ROW_B.comment }
      : { sql: `SELECT post_id, count(*) FROM comments WHERE post_id IN (${ids}) GROUP BY post_id`, rows: PAGE, bytes: PAGE * ROW_B.count },
  ];
}

export const PER_ROW_US = 2; // decoding and building objects, per row
export function cost(stmts: Stmt[], rttMs: number) {
  const rows = stmts.reduce((a, s) => a + s.rows, 0);
  const bytes = stmts.reduce((a, s) => a + s.bytes, 0);
  // 0.2 ms server time per small query, plus moving the bytes over a 1 Gbit/s link.
  const ms = stmts.length * (rttMs + 0.2) + (rows * PER_ROW_US) / 1000 + bytes / 125_000;
  return { queries: stmts.length, rows, bytes, ms };
}
