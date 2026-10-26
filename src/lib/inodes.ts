// A tiny Unix file system, ext2-style. Every file is an inode: type, size, owner, link count and
// block pointers, with no name. Names live only in directories, which are files mapping names
// to inode numbers. 12 direct pointers, then one indirect block of pointers. Paths are resolved
// one directory at a time, counting the disk reads (inode + directory block per step) with a
// cold cache. Operations change names and link counts, never the data, except writes.
// Block numbers are made up; the structure, the walk and the link counting are the real thing.

export const BLOCK = 4096;
export const DIRECT = 12;
export const PTRS = BLOCK / 4; // 4-byte block pointers per indirect block

export type Inode = { ino: number; type: "dir" | "file" | "symlink"; size: number; links: number; mode: string; owner: string; blocks: number[]; indirect: number | null; target?: string; mtime: string };
export type Fs = { inodes: Record<number, Inode>; dirs: Record<number, Record<string, number>>; freed: number[] };

const file = (ino: number, size: number, firstBlock: number, owner = "ana"): Inode => {
  const n = Math.ceil(size / BLOCK);
  const blocks = Array.from({ length: Math.min(n, DIRECT) }, (_, i) => firstBlock + i);
  return { ino, type: "file", size, links: 1, mode: "-rw-r--r--", owner, blocks, indirect: n > DIRECT ? firstBlock + n : null, mtime: "Oct 25 09:12" };
};
const dir = (ino: number, block: number, owner = "root"): Inode => ({ ino, type: "dir", size: BLOCK, links: 2, mode: "drwxr-xr-x", owner, blocks: [block], indirect: null, mtime: "Oct 24 18:03" });

export function fresh(): Fs {
  return {
    inodes: {
      2: dir(2, 100), 11: dir(11, 101), 12: dir(12, 102), 13: { ...dir(13, 103), mode: "drwxrwxrwt" }, 20: dir(20, 104, "ana"),
      31: file(31, 10_200, 2000), 32: file(32, 3_145_728, 5000),
      33: { ino: 33, type: "symlink", size: 9, links: 1, mode: "lrwxrwxrwx", owner: "ana", blocks: [], indirect: null, target: "notes.txt", mtime: "Oct 25 09:13" },
    },
    dirs: { 2: { home: 11, etc: 12, tmp: 13 }, 11: { ana: 20 }, 12: {}, 13: {}, 20: { "notes.txt": 31, "photo.jpg": 32, latest: 33 } },
    freed: [],
  };
}

export type WalkStep = { at: string; ino: number; reads: number; note: string };
export type Walk = { steps: WalkStep[]; ino: number | null; reads: number; error?: string };

// resolve an absolute path, following one level of symlink, counting cold-cache disk reads
export function resolve(fs: Fs, path: string, depth = 0): Walk {
  const parts = path.split("/").filter(Boolean);
  const steps: WalkStep[] = [{ at: "/", ino: 2, reads: 2, note: "the root directory is always inode 2: read its inode, then its directory block" }];
  let cur = 2;
  let reads = 2;
  for (let i = 0; i < parts.length; i++) {
    const name = parts[i];
    const entries = fs.dirs[cur];
    const next = entries?.[name];
    if (next === undefined) return { steps, ino: null, reads, error: `${name}: No such file or directory (ENOENT)` };
    const node = fs.inodes[next];
    const last = i === parts.length - 1;
    if (node.type === "symlink") {
      reads += 1;
      steps.push({ at: name, ino: next, reads: 1, note: `a symlink holding the path “${node.target}”: start resolving that instead` });
      if (depth > 3) return { steps, ino: null, reads, error: "Too many levels of symbolic links (ELOOP)" };
      const base = "/" + parts.slice(0, i).join("/");
      const sub = resolve(fs, node.target!.startsWith("/") ? node.target! : `${base}/${node.target}`, depth + 1);
      return { steps: [...steps, ...sub.steps.slice(1)], ino: sub.ino, reads: reads + sub.reads - 2, error: sub.error };
    }
    const r = node.type === "dir" && !last ? 2 : 1;
    reads += r;
    steps.push({ at: name, ino: next, reads: r, note: node.type === "dir" && !last ? `found “${name}” → inode ${next}; read its inode and directory block` : `found “${name}” → inode ${next}; read the inode` });
    cur = next;
  }
  return { steps, ino: cur, reads };
}

// where byte `offset` of a file lives: a direct pointer, or through the indirect block
export function locate(node: Inode, offset: number) {
  const idx = Math.floor(offset / BLOCK);
  if (idx < DIRECT) return { idx, via: "direct" as const, extraReads: 0, block: node.blocks[idx] };
  return { idx, via: "indirect" as const, extraReads: 1, block: (node.blocks[DIRECT - 1] ?? 0) + 1 + (idx - DIRECT) };
}

export type Op = "read" | "hardlink" | "unlink" | "rename" | "symlinkBroken" | "seek";
export const OPS: Op[] = ["read", "seek", "hardlink", "unlink", "rename", "symlinkBroken"];
export const OP: Record<Op, { label: string; cmd: string; path: string }> = {
  read: { label: "Open a file", cmd: "cat /home/ana/notes.txt", path: "/home/ana/notes.txt" },
  seek: { label: "Read deep in a big file", cmd: "read photo.jpg at 2 MB", path: "/home/ana/photo.jpg" },
  hardlink: { label: "Hard link", cmd: "ln notes.txt backup.txt", path: "/home/ana/backup.txt" },
  unlink: { label: "Link, then delete", cmd: "ln notes.txt backup.txt && rm notes.txt", path: "/home/ana/backup.txt" },
  rename: { label: "Move a file", cmd: "mv notes.txt /tmp/notes.txt", path: "/tmp/notes.txt" },
  symlinkBroken: { label: "Delete a symlink's target", cmd: "rm notes.txt && cat latest", path: "/home/ana/latest" },
};

export type Change = { what: string; kind: "dir" | "inode" | "data" | "none" };
export function apply(op: Op): { fs: Fs; changes: Change[] } {
  const fs = fresh();
  const ana = fs.dirs[20];
  const changes: Change[] = [];
  const link = (name: string, ino: number) => { ana[name] = ino; fs.inodes[ino].links++; changes.push({ what: `directory /home/ana: add “${name}” → inode ${ino}`, kind: "dir" }, { what: `inode ${ino}: link count ${fs.inodes[ino].links - 1} → ${fs.inodes[ino].links}`, kind: "inode" }); };
  const unlink = (d: Record<string, number>, dirName: string, name: string) => {
    const ino = d[name];
    delete d[name];
    const node = fs.inodes[ino];
    node.links--;
    changes.push({ what: `directory ${dirName}: remove “${name}”`, kind: "dir" }, { what: `inode ${ino}: link count ${node.links + 1} → ${node.links}`, kind: "inode" });
    if (node.links === 0) {
      fs.freed.push(ino);
      changes.push({ what: `inode ${ino} and its ${Math.ceil(node.size / BLOCK)} blocks are freed (nothing else names it, and no process has it open)`, kind: "data" });
    } else changes.push({ what: `inode ${ino} stays: another name still points to it, so no data moves`, kind: "none" });
  };
  if (op === "hardlink") link("backup.txt", 31);
  if (op === "unlink") { link("backup.txt", 31); unlink(ana, "/home/ana", "notes.txt"); }
  if (op === "rename") {
    delete ana["notes.txt"];
    fs.dirs[13]["notes.txt"] = 31;
    changes.push({ what: "directory /home/ana: remove “notes.txt”", kind: "dir" }, { what: "directory /tmp: add “notes.txt” → inode 31", kind: "dir" }, { what: "inode 31 and its data don't move: same file system, so mv only edits two directories", kind: "none" });
  }
  if (op === "symlinkBroken") unlink(ana, "/home/ana", "notes.txt");
  if (op === "read" || op === "seek") changes.push({ what: "nothing changes (the access time may be updated, unless mounted noatime/relatime)", kind: "none" });
  return { fs, changes };
}

// Largest file with 12 direct pointers plus single, double and triple indirect blocks
export function maxFile(block: number) {
  const p = block / 4;
  const direct = DIRECT * block, single = p * block, double = p * p * block, triple = p * p * p * block;
  return { direct, single, double, triple, total: direct + single + double + triple };
}

// A 100 GB ext4 volume made with the default of one inode per 16 KB, filled with 1 KB files
export function inodeExhaustion(diskGB = 100, bytesPerInode = 16_384, fileBytes = 1024) {
  const inodes = Math.floor((diskGB * 1024 ** 3) / bytesPerInode);
  const perFile = Math.ceil(fileBytes / BLOCK) * BLOCK; // a file uses whole blocks
  const usedGB = (inodes * perFile) / 1024 ** 3;
  return { inodes, usedGB, freeShare: 1 - usedGB / diskGB };
}

export const fmtBytes = (b: number) => {
  const u = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b >= 100 || Number.isInteger(b) ? Math.round(b) : b.toFixed(1)} ${u[i]}`;
};
