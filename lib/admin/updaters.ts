/**
 * Functional updaters for the admin editor. Every write is a function of the LATEST state, so an async
 * completion (an image upload) changes only the one field it owns and never writes back a stale copy of
 * a list. List items are addressed by a stable key, resolved to an index only when the update is applied,
 * so a result still lands on the right item after a reorder, and is dropped if the item was removed.
 * Pure (no React), so it is unit-tested in lib/admin/updaters.test.ts.
 */

export type Updater<T> = (fn: (prev: T) => T) => void;

/** Updater for one key of an object. */
export function field<T, K extends keyof T>(up: Updater<T>, key: K): Updater<T[K]> {
  return (fn) =>
    up((prev) => {
      const next = fn(prev[key]);
      // Unchanged child -> unchanged parent (a dropped late update leaves the state untouched).
      return Object.is(next, prev[key]) ? prev : { ...prev, [key]: next };
    });
}

/** Setter (value in, nothing out) for a leaf input. */
export function setter<T>(up: Updater<T>): (value: T) => void {
  return (value) => up(() => value);
}

/**
 * Updater for the list item whose stable key is `key`. `keys()` must return the keys in the list's
 * CURRENT order at the time the update is applied. Returns `prev` unchanged when the key is gone.
 */
export function atKey<T>(up: Updater<T[]>, keys: () => readonly string[], key: string): Updater<T> {
  return (fn) =>
    up((prev) => {
      const i = keys().indexOf(key);
      if (i < 0 || i >= prev.length) return prev;
      const next = prev.slice();
      next[i] = fn(prev[i]);
      return next;
    });
}

/** Moves one element; out-of-range moves return `list` unchanged. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list.slice();
  const next = list.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

export function removeItem<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}
