import { describe, expect, it } from "vitest";
import { defaultContent, type ContentData, type Project } from "@/lib/content";
import { addKey, createKeyList, isAlive, keysOf, kill, moveKey, removeKey, syncLength, type KeyList } from "./keyed-list";
import { atKey, field, moveItem, removeItem, type Updater } from "./updaters";

/**
 * End-to-end model of the editor: a functional content store, plus the projects ListEditor's KeyList.
 * `mount()` models (re)mounting the ListEditor: a fresh KeyList for the current items.
 */
function editor() {
  let state: ContentData = structuredClone(defaultContent);
  const up: Updater<ContentData> = (fn) => {
    state = fn(state);
  };
  const projects = field(up, "projects");
  let list: KeyList = createKeyList(state.projects.length);
  return {
    get: () => state,
    get list() {
      return list;
    },
    /** What ImageField captures when an upload starts on the item at `index`. */
    startUpload(index: number) {
      const l = list;
      const key = l.ids[index];
      return {
        finish(url: string): "applied" | "dropped" {
          if (!isAlive(l, key)) return "dropped";
          atKey<Project>(projects, () => keysOf(l), key)((p) => ({ ...p, image: url }));
          return "applied";
        },
        /** Apply WITHOUT the alive check, to prove atKey alone never mis-targets. */
        forceFinish(url: string) {
          atKey<Project>(projects, () => keysOf(l), key)((p) => ({ ...p, image: url }));
        },
      };
    },
    move(from: number, to: number) {
      moveKey(list, from, to);
      projects((prev) => moveItem(prev, from, to));
    },
    remove(index: number) {
      removeKey(list, index);
      projects((prev) => removeItem(prev, index));
    },
    /** Discard: content replaced wholesale; the generation key remounts the lists. */
    discard(saved: ContentData) {
      state = structuredClone(saved);
      kill(list);
      list = createKeyList(state.projects.length);
    },
    /** Section switch that unmounts and later remounts the list. */
    unmountRemount() {
      kill(list);
      list = createKeyList(state.projects.length);
    },
  };
}

const images = (c: ContentData) => c.projects.map((p) => p.image);

describe("KeyList bookkeeping", () => {
  it("move / remove / add keep keys aligned with items", () => {
    const l = createKeyList(3);
    const [a, b, c] = l.ids;
    moveKey(l, 0, 2);
    expect(l.ids).toEqual([b, c, a]);
    removeKey(l, 1);
    expect(l.ids).toEqual([b, a]);
    const d = addKey(l);
    expect(l.ids).toEqual([b, a, d]);
    expect(new Set(l.ids).size).toBe(3);
  });

  it("regenerates keys when the length changes outside its own operations", () => {
    const l = createKeyList(2);
    const old = l.ids.slice();
    syncLength(l, 2);
    expect(l.ids).toEqual(old);
    syncLength(l, 3);
    expect(l.ids).toHaveLength(3);
    expect(l.ids.some((k) => old.includes(k))).toBe(false);
  });

  it("a dead list resolves no keys", () => {
    const l = createKeyList(2);
    const k = l.ids[0];
    kill(l);
    expect(keysOf(l)).toEqual([]);
    expect(isAlive(l, k)).toBe(false);
  });
});

describe("late upload results (end to end)", () => {
  it("(a) Discard with an unchanged count: the late result is dropped, never applied to another project", () => {
    const e = editor();
    const saved = structuredClone(e.get());
    const before = images(saved);
    const upload = e.startUpload(0);
    e.move(0, 1);
    e.discard(saved);
    expect(e.get().projects).toHaveLength(saved.projects.length);
    expect(upload.finish("/late.webp")).toBe("dropped");
    upload.forceFinish("/late.webp");
    expect(images(e.get())).toEqual(before);
  });

  it("(b) unmount/remount (section switch) then a move: the late result is dropped, never mis-targeted", () => {
    const e = editor();
    const before = images(e.get());
    const upload = e.startUpload(0);
    e.unmountRemount();
    e.move(0, 2);
    const afterMove = images(e.get());
    expect(upload.finish("/late.webp")).toBe("dropped");
    upload.forceFinish("/late.webp");
    expect(images(e.get())).toEqual(afterMove);
    expect(images(e.get()).sort()).toEqual(before.slice().sort());
  });

  it("while the list stays mounted, the late result follows its project through moves", () => {
    const e = editor();
    const slug = e.get().projects[0].slug;
    const upload = e.startUpload(0);
    e.move(0, 3);
    e.move(3, 1);
    expect(upload.finish("/late.webp")).toBe("applied");
    const hit = e.get().projects.filter((p) => p.image === "/late.webp");
    expect(hit.map((p) => p.slug)).toEqual([slug]);
  });

  it("a late result for a removed project is dropped", () => {
    const e = editor();
    const upload = e.startUpload(2);
    e.remove(2);
    expect(upload.finish("/late.webp")).toBe("dropped");
    expect(e.get().projects.some((p) => p.image === "/late.webp")).toBe(false);
  });
});
