// Normalize or denormalize: a blog's feed page shows each post with its author's
// name and its comment count. Normalized, those live in other tables and every feed
// read joins and counts. Denormalized, they are copied onto the post row: the feed is
// one scan, but every rename and every comment must update the copies too.
// Costs are rows touched, counted on a small dataset, scaled by the workload.

export const USERS = 3;
export const POSTS = 10;
export const COMMENTS = 40;
export const FEED_SIZE = 10;

export type Design = "normalized" | "denormalized" | "async";

export const DESIGNS: { id: Design; label: string; what: string }[] = [
  { id: "normalized", label: "Normalized", what: "posts(author_id), users(name), comments(post_id). The feed joins users and counts comments." },
  { id: "denormalized", label: "Denormalized", what: "posts also store author_name and comment_count. Writes update the copies in the same transaction." },
  { id: "async", label: "Denormalized, updated async", what: "Writes go to the source table; a background job updates the copies seconds later." },
];

export type Op = "feed" | "comment" | "rename";
export const OPS: Record<Op, { label: string; what: string }> = {
  feed: { label: "Read the feed", what: "The 10 newest posts with author names and comment counts." },
  comment: { label: "Post a comment", what: "Insert the comment; a denormalized design also bumps the post's count." },
  rename: { label: "Rename an author", what: "Change one user's name; a denormalized design also rewrites it on every post." },
};

// Rows touched per operation. Comments per post and posts per author come from the dataset.
export const POSTS_PER_AUTHOR = POSTS / USERS;
export const COMMENTS_PER_POST = COMMENTS / POSTS;

export function rows(design: Design, op: Op): { read: number; write: number; steps: string[] } {
  if (op === "feed") {
    if (design === "normalized") return { read: FEED_SIZE + FEED_SIZE + FEED_SIZE * COMMENTS_PER_POST, write: 0, steps: [`${FEED_SIZE} posts`, `join ${FEED_SIZE} user rows`, `count ${FEED_SIZE * COMMENTS_PER_POST} comment rows`] };
    return { read: FEED_SIZE, write: 0, steps: [`${FEED_SIZE} posts, everything on the row`] };
  }
  if (op === "comment") {
    if (design === "normalized") return { read: 0, write: 1, steps: ["insert 1 comment"] };
    if (design === "denormalized") return { read: 0, write: 2, steps: ["insert 1 comment", "update posts.comment_count (same transaction, lock on the post row)"] };
    return { read: 0, write: 2, steps: ["insert 1 comment", "later: a job recounts and updates posts.comment_count"] };
  }
  if (design === "normalized") return { read: 0, write: 1, steps: ["update 1 user row"] };
  if (design === "denormalized") return { read: 0, write: 1 + POSTS_PER_AUTHOR, steps: ["update 1 user row", `update author_name on ${POSTS_PER_AUTHOR} posts (same transaction)`] };
  return { read: 0, write: 1 + POSTS_PER_AUTHOR, steps: ["update 1 user row", `later: a job rewrites author_name on ${POSTS_PER_AUTHOR} posts`] };
}

export const MIXES = [
  { id: "readHeavy", label: "100 reads per write", reads: 100, writes: 1 },
  { id: "balanced", label: "10 reads per write", reads: 10, writes: 1 },
  { id: "writeHeavy", label: "1 read per write", reads: 1, writes: 1 },
];

// Rows touched per 100 operations at a given mix; writes are 90% comments, 10% renames.
export function perHundred(design: Design, mix: (typeof MIXES)[number]): { read: number; write: number; total: number } {
  const total = mix.reads + mix.writes;
  const feed = rows(design, "feed");
  const comment = rows(design, "comment");
  const rename = rows(design, "rename");
  const read = (feed.read * mix.reads * 100) / total;
  const write = ((comment.write * 0.9 + rename.write * 0.1) * mix.writes * 100) / total;
  return { read, write, total: read + write };
}

// What can go wrong with copies: the async job lags, the sync one holds locks.
export const RISKS: Record<Design, string> = {
  normalized: "Nothing to keep in sync. The feed is slower, and the comment count is computed on every read.",
  denormalized: "Every comment locks its post row to bump the count; a hot post serializes its commenters. A failed half-update leaves a wrong count unless both writes share a transaction.",
  async: "Between the write and the job, the feed shows the old name or count. Readers may see a comment they posted without the count moving.",
};

export const STALENESS: Record<Design, string> = { normalized: "never", denormalized: "never", async: "seconds" };
