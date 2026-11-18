import { describe, expect, it } from "vitest";
import { defaultContent, type ContentData, type Project } from "@/lib/content";
import { atKey, field, moveItem, removeItem, setter, type Updater } from "./updaters";

/** A tiny store standing in for React's functional setState. */
function store<T>(initial: T) {
  let state = initial;
  const up: Updater<T> = (fn) => {
    state = fn(state);
  };
  return { up, get: () => state };
}

/** Mirrors ListEditor: a parallel list of stable keys, mutated on move/remove. */
function projectsHarness() {
  const s = store<ContentData>(structuredClone(defaultContent));
  let keys = s.get().projects.map((_, i) => `k${i}`);
  const projects = field(s.up, "projects");
  const item = (key: string) => atKey<Project>(projects, () => keys, key);
  return {
    s,
    item,
    move(from: number, to: number) {
      keys = moveItem(keys, from, to);
      projects((prev) => moveItem(prev, from, to));
    },
    remove(index: number) {
      keys = removeItem(keys, index);
      projects((prev) => removeItem(prev, index));
    },
    alive: (key: string) => keys.includes(key),
  };
}

/** What ImageField does when an upload resolves. */
const applyImage = (up: Updater<Project>, url: string) => up((p) => ({ ...p, image: url }));

describe("admin updaters", () => {
  it("field + setter change one key from the latest state", () => {
    const s = store({ a: "1", b: "2" });
    const setA = setter(field(s.up, "a"));
    const setB = setter(field(s.up, "b"));
    setA("x");
    setB("y");
    expect(s.get()).toEqual({ a: "x", b: "y" });
  });

  it("a late image result does not revert edits made to another project meanwhile", () => {
    const h = projectsHarness();
    const target = h.item("k0"); // captured when the upload started
    setter(field(h.item("k1"), "title"))("Edited while uploading");
    setter(field(h.item("k0"), "description"))("Edited the same project too");
    applyImage(target, "https://x.public.blob.vercel-storage.com/new.webp");
    const [p0, p1] = h.s.get().projects;
    expect(p0.image).toBe("https://x.public.blob.vercel-storage.com/new.webp");
    expect(p0.description).toBe("Edited the same project too");
    expect(p1.title).toBe("Edited while uploading");
  });

  it("a late image result lands on the right project after a reorder", () => {
    const h = projectsHarness();
    const slug0 = h.s.get().projects[0].slug;
    const target = h.item("k0");
    h.move(0, 2);
    applyImage(target, "/new.webp");
    const projects = h.s.get().projects;
    expect(projects[2].slug).toBe(slug0);
    expect(projects[2].image).toBe("/new.webp");
    expect(projects.filter((p) => p.image === "/new.webp")).toHaveLength(1);
  });

  it("a late image result is dropped when its project was removed", () => {
    const h = projectsHarness();
    const target = h.item("k1");
    h.remove(1);
    const before = h.s.get();
    expect(h.alive("k1")).toBe(false);
    applyImage(target, "/new.webp");
    expect(h.s.get()).toBe(before);
    expect(h.s.get().projects.some((p) => p.image === "/new.webp")).toBe(false);
  });

  it("moveItem and removeItem are pure and bounds-safe", () => {
    const l = ["a", "b", "c"];
    expect(moveItem(l, 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(l, 0, 5)).toEqual(l);
    expect(removeItem(l, 1)).toEqual(["a", "c"]);
    expect(l).toEqual(["a", "b", "c"]);
  });
});
