/**
 * Stable keys for one rendered list (ListEditor), kept in step with the list's items: the same move /
 * remove / add operations are applied to both. A KeyList is created per mounted ListEditor and killed when
 * it unmounts (or when the content is replaced wholesale, which remounts the lists): a dead list resolves
 * no keys, so a late write that captured one of its keys is dropped instead of landing on whatever item
 * now sits at that index. Pure and mutable by design (held in a React ref); tested in keyed-list.test.ts.
 */
import { moveItem, removeItem } from "./updaters";

export type KeyList = { ids: string[]; dead: boolean };

let counter = 0;
export const newKey = () => `k${++counter}`;

export function createKeyList(length: number, makeKey: () => string = newKey): KeyList {
  return { ids: Array.from({ length }, makeKey), dead: false };
}

/** If the items' length changed outside this list's own operations, the old keys mean nothing: regenerate. */
export function syncLength(list: KeyList, length: number, makeKey: () => string = newKey): void {
  if (list.ids.length !== length) list.ids = Array.from({ length }, makeKey);
}

export function moveKey(list: KeyList, from: number, to: number): void {
  list.ids = moveItem(list.ids, from, to);
}

export function removeKey(list: KeyList, index: number): void {
  list.ids = removeItem(list.ids, index);
}

export function addKey(list: KeyList, makeKey: () => string = newKey): string {
  const key = makeKey();
  list.ids = [...list.ids, key];
  return key;
}

export function kill(list: KeyList): void {
  list.dead = true;
}

/** The current key order, or none for a dead list (so `atKey` drops the write). */
export function keysOf(list: KeyList): readonly string[] {
  return list.dead ? [] : list.ids;
}

export function isAlive(list: KeyList, key: string): boolean {
  return !list.dead && list.ids.includes(key);
}
