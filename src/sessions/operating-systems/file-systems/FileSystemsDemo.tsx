"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { BLOCK, DIRECT, OP, OPS, PTRS, apply, fmtBytes, inodeExhaustion, locate, maxFile, resolve, type Fs, type Op } from "@/lib/inodes";

const ACCENT = "var(--os)";
const CHANGE_COLOR = { dir: "var(--c1)", inode: "var(--c2)", data: "var(--bad)", none: "var(--muted)" };

function Listing({ fs, dirIno, path }: { fs: Fs; dirIno: number; path: string }) {
  const entries = Object.entries(fs.dirs[dirIno] ?? {});
  return (
    <div>
      <p className="font-mono text-[11px] text-[var(--faint)]">$ ls -li {path}</p>
      <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
        {entries.length === 0 && <li className="text-[var(--faint)]">(empty)</li>}
        {entries.map(([name, ino]) => {
          const n = fs.inodes[ino];
          return (
            <li key={name} className="grid grid-cols-[2.2rem_6.2rem_1rem_1fr] gap-1 sm:grid-cols-[2.2rem_6.5rem_1.2rem_5rem_1fr]">
              <span style={{ color: "var(--c2)" }}>{ino}</span>
              <span className="text-[var(--muted)]">{n.mode}</span>
              <span style={{ color: n.links > 1 ? "var(--c2)" : undefined }}>{n.links}</span>
              <span className="hidden text-right text-[var(--muted)] sm:inline">{n.type === "file" ? fmtBytes(n.size) : n.size}</span>
              <span style={{ color: "var(--c1)" }}>{name}{n.type === "symlink" ? ` -> ${n.target}` : n.type === "dir" ? "/" : ""}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function FileSystemsDemo() {
  const [op, setOp] = useState<Op>("read");
  const [offsetMb, setOffsetMb] = useState(2);
  const [blockKb, setBlockKb] = useState(4);
  const { stage, busy, run } = useWalk(5, 1100);
  const on = (i: number) => stage === i;
  const { fs, changes } = apply(op);
  const walk = resolve(fs, OP[op].path);
  const node = walk.ino !== null ? fs.inodes[walk.ino] : null;
  const where = node && node.type === "file" ? locate(node, op === "seek" ? Math.min(offsetMb * 1024 * 1024, node.size - 1) : 0) : null;
  const sizes = maxFile(blockKb * 1024);
  const ex = inodeExhaustion();
  const dataReads = where ? 1 + where.extraReads : 0;

  const nodes: MapNode[] = [
    { id: "proc", label: "Process", sub: OP[op].cmd, at: [12, 25], mobileAt: [28, 10], state: on(0) ? "active" : "idle" },
    { id: "vfs", label: "Kernel (VFS)", sub: `${walk.reads + dataReads} disk reads, cold`, at: [46, 25], mobileAt: [72, 10], state: walk.error ? "bad" : on(0) ? "active" : "idle" },
    { id: "dirs", label: "Directories", sub: "name → inode number", at: [84, 25], mobileAt: [28, 45], state: on(0) || on(3) ? "active" : "idle" },
    { id: "inodes", label: "Inode table", sub: node ? `inode ${node.ino}: ${node.links} link${node.links === 1 ? "" : "s"}` : "no inode", at: [46, 78], mobileAt: [72, 45], state: on(1) ? "active" : walk.error ? "bad" : "idle" },
    { id: "data", label: "Data blocks", sub: where ? `block ${where.block}${where.via === "indirect" ? " via indirect" : ""}` : "none read", at: [84, 78], mobileAt: [50, 84], state: on(2) ? "active" : "idle" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("a", ["proc", "vfs", "dirs"], { label: OP[op].path.split("/").filter(Boolean).join(" › ") })
    : stage === 1 ? hops("b", ["dirs", "inodes"], { label: walk.ino !== null ? `inode ${walk.ino}` : "ENOENT", tone: walk.error ? "bad" : undefined })
    : stage === 2 ? hops("c", ["inodes", "data"], { label: where ? (where.via === "indirect" ? "pointer block → data" : `block ${where.block}`) : "nothing", tone: where ? undefined : "bad" })
    : stage === 3 ? hops("d", ["vfs", "dirs"], { label: changes[0]?.kind === "dir" ? "edit entries" : "no change" })
    : stage === 4 ? hops("e", ["vfs", "inodes"], { label: `${ex.inodes.toLocaleString("en-US")} inodes` })
    : [];

  const captions = [
    `Step 1: the kernel walks ${OP[op].path} from the root, one directory at a time: ${walk.reads} disk reads with a cold cache.${walk.error ? ` It stops: ${walk.error}.` : ""}`,
    node ? `Step 2: inode ${node.ino} holds the type, size (${fmtBytes(node.size)}), owner, permissions, link count (${node.links}) and block pointers. Not the name.` : "Step 2: there's no inode to read: the name led nowhere.",
    where ? `Step 3: ${where.via === "direct" ? `block ${where.idx} of the file is one of the ${DIRECT} direct pointers` : `block ${where.idx} is past the ${DIRECT} direct pointers, so the kernel reads the indirect block first`}: data at disk block ${where.block}.` : "Step 3: no data blocks to find.",
    `Step 4: ${changes.map((c) => c.what).join("; ")}.`,
    `Step 5: with ${blockKb} KB blocks the largest file is ${fmtBytes(sizes.total)}. A 100 GB disk full of 1 KB files runs out of inodes with ${Math.round(ex.freeShare * 100)}% of its space free.`,
  ];
  const caption = stage !== null ? captions[stage] : `${OP[op].cmd}: ${walk.error ? walk.error : `resolves to inode ${walk.ino}`}, ${walk.reads + dataReads} disk reads with a cold cache.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="File systems and inodes"
        blurb="On disk, a file isn't a name. It's an inode: a numbered record with the size, owner, permissions and pointers to the data blocks. Names live in directories, which just map names to inode numbers. That one split explains hard links, cheap renames, and deleting a file another name still points to. A tiny ext2-style file system, run for real."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A process opens a path; the kernel looks names up in directories, reads the inode, then the data blocks"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "proc", to: "vfs", label: "open(path)" },
                  { from: "vfs", to: "dirs", label: "look up" },
                  { from: "dirs", to: "inodes", label: "inode number" },
                  { from: "inodes", to: "data", label: "block pointers" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Directories after the command">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">After: {OP[op].cmd}</p>
                <Listing fs={fs} dirIno={20} path="/home/ana" />
                {op === "rename" && <Listing fs={fs} dirIno={13} path="/tmp" />}
                <p className="text-[11px] text-[var(--muted)]">Columns: inode number, permissions, link count{" "}<span className="hidden sm:inline">, size</span>, name. The name is the only thing stored in the directory.</p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setOp("unlink")} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Delete a linked file
                </button>
                <button type="button" onClick={() => setOp("symlinkBroken")} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Break a symlink
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Walking…">
                Walk the path
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Resolve the path, one directory at a time" what="The kernel starts at the root directory (always inode 2 on ext file systems), reads it, finds the next name, gets its inode number, reads that, and so on. With a cold cache each step is a disk read or two; the dentry cache usually saves them." accent={ACCENT} active={on(0)}>
                <div className="space-y-3">
                  <Choices<Op> accent={ACCENT} value={op} onChange={setOp} options={OPS.map((id) => ({ id, label: OP[id].label }))} />
                  <p className="font-mono text-xs text-[var(--muted)]">$ {OP[op].cmd}</p>
                  <ol className="space-y-0.5 font-mono text-[11px]">
                    {walk.steps.map((s, i) => (
                      <li key={i}>
                        <span style={{ color: "var(--c1)" }}>{s.at}</span> → inode <span style={{ color: "var(--c2)" }}>{s.ino}</span> <span className="text-[var(--faint)]">(+{s.reads} read{s.reads === 1 ? "" : "s"}) {s.note}</span>
                      </li>
                    ))}
                    {walk.error && <li className="text-[var(--bad)]">{walk.error}</li>}
                  </ol>
                </div>
              </FlowStep>
              <FlowArrow label="an inode number" accent={ACCENT} active={on(1)} />

              <FlowStep n={2} title="Read the inode: everything but the name" what="The inode is the file: type, size, owner, permissions, timestamps, how many names point to it (the link count) and where its data is. `stat` prints it. The name isn't in it, which is why one file can have several." accent={ACCENT} active={on(1)}>
                {node ? (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] sm:grid-cols-3">
                    <div><dt className="text-[var(--faint)]">inode</dt><dd>{node.ino}</dd></div>
                    <div><dt className="text-[var(--faint)]">type</dt><dd>{node.type}</dd></div>
                    <div><dt className="text-[var(--faint)]">size</dt><dd>{fmtBytes(node.size)}</dd></div>
                    <div><dt className="text-[var(--faint)]">mode</dt><dd>{node.mode}</dd></div>
                    <div><dt className="text-[var(--faint)]">owner</dt><dd>{node.owner}</dd></div>
                    <div><dt className="text-[var(--faint)]">links</dt><dd>{node.links}</dd></div>
                    <div className="col-span-2 sm:col-span-3"><dt className="text-[var(--faint)]">block pointers</dt><dd className="break-all">[{node.blocks.join(", ")}]{node.indirect !== null ? ` + indirect ${node.indirect}` : ""}</dd></div>
                  </dl>
                ) : (
                  <p className="font-mono text-xs text-[var(--bad)]">No inode: {walk.error}</p>
                )}
              </FlowStep>
              <FlowArrow label="block pointers" accent={ACCENT} active={on(2)} />

              <FlowStep n={3} title="Find the data blocks" what={`Data lives in ${BLOCK / 1024} KB blocks. The inode points straight at the first ${DIRECT}; past those it points to an indirect block holding ${PTRS} more pointers, so reading deep into a big file costs an extra read. (ext4 uses extents, ranges of blocks, to the same end.)`} accent={ACCENT} active={on(2)}>
                <div className="space-y-3">
                  {op === "seek" && node && (
                    <Slider label="Read at offset" value={offsetMb} min={0} max={3} step={0.01} format={(v) => (v < 0.05 ? `${Math.round(v * 1024)} KB` : `${v.toFixed(2)} MB`)} onChange={setOffsetMb} accent={ACCENT} />
                  )}
                  <p className="font-mono text-xs">
                    {where ? (
                      <>
                        file block {where.idx} → {where.via === "direct" ? `direct pointer ${where.idx}` : `indirect block ${node!.indirect}, slot ${where.idx - DIRECT}`} → disk block {where.block}
                        <span className="text-[var(--faint)]"> · {dataReads} read{dataReads === 1 ? "" : "s"}</span>
                      </>
                    ) : (
                      "nothing to read"
                    )}
                  </p>
                </div>
              </FlowStep>
              <FlowArrow label="names change, data stays" accent={ACCENT} active={on(3)} />

              <FlowStep n={4} title="Names are just directory entries" what="A hard link adds a second name for the same inode and bumps its link count. rm removes one name; the data is freed only when the count reaches 0 and no process has the file open. mv within a file system edits two directories and moves no data. A symlink is a small file holding a path, which can dangle." accent={ACCENT} active={on(3)}>
                <ul className="space-y-1 text-xs">
                  {changes.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: CHANGE_COLOR[c.kind] }} />
                      <span>{c.what}</span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="the limits" accent={ACCENT} active={on(4)} />

              <FlowStep n={5} title="Two limits: file size and inode count" what="Pointers per block decide the biggest possible file. And a file system makes a fixed number of inodes when it's formatted (ext4: one per 16 KB by default), so millions of tiny files can fill the inode table with free space left: “No space left on device” while df -h shows room." accent={ACCENT} active={on(4)}>
                <div className="space-y-3">
                  <Choices<"1" | "4"> label="Block size" accent={ACCENT} value={String(blockKb) as "1" | "4"} onChange={(v) => setBlockKb(Number(v))} options={[{ id: "1", label: "1 KB" }, { id: "4", label: "4 KB" }]} />
                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-5">
                    <p><span className="block text-[var(--faint)]">12 direct</span>{fmtBytes(sizes.direct)}</p>
                    <p><span className="block text-[var(--faint)]">+ single</span>{fmtBytes(sizes.single)}</p>
                    <p><span className="block text-[var(--faint)]">+ double</span>{fmtBytes(sizes.double)}</p>
                    <p><span className="block text-[var(--faint)]">+ triple</span>{fmtBytes(sizes.triple)}</p>
                    <p><span className="block text-[var(--faint)]">largest file</span><span style={{ color: ACCENT }}>{fmtBytes(sizes.total)}</span></p>
                  </div>
                  <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px]">{`$ df -h /data     → 100G size, ${Math.round(ex.usedGB)}G used, ${Math.round(100 - ex.usedGB)}G free
$ df -i /data     → ${ex.inodes.toLocaleString("en-US")} inodes, 100% used
$ touch /data/x   → No space left on device`}</pre>
                  <p className="text-[11px] text-[var(--faint)]">A 100 GB volume with one inode per 16 KB, filled with 1 KB files (each still takes a whole {BLOCK / 1024} KB block). Block numbers in this file system are made up; the structure and arithmetic are real.</p>
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}
