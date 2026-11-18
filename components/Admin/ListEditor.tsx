"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { addKey, createKeyList, isAlive, keysOf, kill, moveKey, removeKey, syncLength, type KeyList } from "@/lib/admin/keyed-list";
import { atKey, moveItem, removeItem, type Updater } from "@/lib/admin/updaters";
import { useFieldError } from "./errors";
import { dangerButton, secondaryButton } from "./fields";

type Props<T> = {
  /** Content path of the array, e.g. `projects.0.story.tools`. */
  path: string;
  /** Visible heading of the list. */
  title: string;
  description?: ReactNode;
  items: T[];
  /** Functional updater for the whole list (applied to the latest state). */
  update: Updater<T[]>;
  /** A blank item for "Add". */
  create: () => T;
  /** Short name of one item for buttons and announcements, e.g. "Tool 2" or the project's title. */
  itemLabel: (item: T, index: number) => string;
  /** Singular noun for the add button, e.g. "tool". */
  noun: string;
  /**
   * `update` writes to THIS item by its stable key, so it stays correct if called later (an upload)
   * after edits, moves or removals; `alive()` says whether the item still exists.
   */
  renderItem: (item: T, index: number, update: Updater<T>, itemPath: string, alive: () => boolean) => ReactNode;
  /** Ask before removing (for items that hold a lot of text, like a project). */
  confirmRemove?: boolean;
  /** Render each item as a collapsible <details> with the label as its summary. */
  collapsible?: boolean;
};

type Pending = { index: number; control: "up" | "down" | "remove" | "add" | "summary" } | null;

/**
 * A repeatable list: add, remove and reorder with ordinary buttons (keyboard and touch operable, no
 * drag-and-drop). Items get stable keys from a parallel id list so moving an item moves its open/closed
 * state with it, and focus follows the button that was pressed.
 */
export function ListEditor<T>({
  path,
  title,
  description,
  items,
  update,
  create,
  itemLabel,
  noun,
  renderItem,
  confirmRemove,
  collapsible,
}: Props<T>) {
  const errors = useFieldError();
  // Stable keys for this mounted list (lib/admin/keyed-list.ts). Killed on unmount, so a late write captured
  // from this instance (an upload) is dropped rather than applied by index to a remounted list.
  const keyRef = useRef<KeyList | null>(null);
  keyRef.current ??= createKeyList(items.length);
  const keys = keyRef.current;
  syncLength(keys, items.length);
  useEffect(() => {
    keys.dead = false; // StrictMode runs setup -> cleanup -> setup on the same instance
    return () => kill(keys);
  }, [keys]);

  const [announcement, setAnnouncement] = useState("");
  const pending = useRef<Pending>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  // After a structural change, put focus back on the equivalent control so keyboard users keep their place.
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    if (p.control === "add") {
      // A new item: open it (if collapsible) and focus its first input; an emptied list: the Add button.
      const li = items.length ? (listRef.current?.children[items.length - 1] as HTMLElement | undefined) : undefined;
      const details = li?.querySelector("details");
      if (details) details.open = true;
      (li?.querySelector<HTMLElement>("input, textarea, select") ?? addRef.current)?.focus();
      return;
    }
    const li = listRef.current?.children[Math.min(p.index, items.length - 1)] as HTMLElement | undefined;
    const btn =
      li?.querySelector<HTMLButtonElement>(`[data-control="${p.control}"]:not(:disabled)`) ??
      li?.querySelector<HTMLButtonElement>("[data-control]:not(:disabled)");
    btn?.focus();
  });

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    moveKey(keys, from, to);
    errors.clearUnder(path);
    pending.current = { index: to, control: to < from ? "up" : "down" };
    setAnnouncement(`${itemLabel(items[from], from)} moved to position ${to + 1} of ${items.length}.`);
    update((prev) => moveItem(prev, from, to));
  };

  const remove = (index: number) => {
    const label = itemLabel(items[index], index);
    if (confirmRemove && !window.confirm(`Remove “${label}”? This deletes it from the editor; it is gone from the site once you save.`)) {
      return;
    }
    removeKey(keys, index);
    errors.clearUnder(path);
    pending.current = items.length > 1 ? { index: Math.min(index, items.length - 2), control: "remove" } : { index: 0, control: "add" };
    setAnnouncement(`${label} removed.`);
    update((prev) => removeItem(prev, index));
  };

  const add = () => {
    addKey(keys);
    pending.current = { index: items.length, control: "add" };
    setAnnouncement(`New ${noun} added at position ${items.length + 1}.`);
    const blank = create();
    update((prev) => [...prev, blank]);
  };

  const headingId = `${path.replace(/[^a-zA-Z0-9]+/g, "-")}-heading`;
  const listError = errors.get(path);

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <h3 id={headingId} className="text-base font-semibold tracking-normal text-neutral-900">
        {title} <span className="font-normal text-neutral-600">({items.length})</span>
      </h3>
      {description && <p className="mt-1 text-sm text-neutral-600">{description}</p>}
      {listError && <p className="mt-1 text-sm font-medium text-red-800">{listError}</p>}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {items.length === 0 && <p className="mt-3 text-sm text-neutral-600">No {noun}s yet.</p>}
      <ol ref={listRef} className="mt-3 grid min-w-0 gap-3">
        {items.map((item, i) => {
          const label = itemLabel(item, i);
          const itemPath = `${path}.${i}`;
          const key = keys.ids[i];
          const itemUpdate = atKey(update, () => keysOf(keys), key);
          const alive = () => isAlive(keys, key);
          const controls = (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-control="up"
                className={secondaryButton}
                disabled={i === 0}
                aria-label={`Move ${label} up`}
                onClick={() => move(i, i - 1)}
              >
                <span aria-hidden="true">↑</span>
                <span className="hidden sm:inline">Up</span>
              </button>
              <button
                type="button"
                data-control="down"
                className={secondaryButton}
                disabled={i === items.length - 1}
                aria-label={`Move ${label} down`}
                onClick={() => move(i, i + 1)}
              >
                <span aria-hidden="true">↓</span>
                <span className="hidden sm:inline">Down</span>
              </button>
              <button
                type="button"
                data-control="remove"
                className={dangerButton}
                aria-label={`Remove ${label}`}
                onClick={() => remove(i)}
              >
                Remove
              </button>
            </div>
          );
          const hasError = Boolean(errors.get(itemPath)) || errors.hasUnder(itemPath);
          return (
            <li key={key} className="min-w-0 rounded-lg border border-neutral-300 bg-neutral-50">
              {collapsible ? (
                <details className="group min-w-0">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 text-base font-semibold text-neutral-900 hover:bg-neutral-100">
                    <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">
                      ▸
                    </span>
                    <span className="min-w-0 flex-1 break-words">{label}</span>
                    {hasError && <span className="rounded bg-red-100 px-2 py-0.5 text-sm font-medium text-red-800">Has errors</span>}
                  </summary>
                  <div className="grid min-w-0 gap-4 border-t border-neutral-300 p-4">
                    {controls}
                    {renderItem(item, i, itemUpdate, itemPath, alive)}
                  </div>
                </details>
              ) : (
                <div className="grid min-w-0 gap-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-neutral-700">{label}</span>
                    {controls}
                  </div>
                  {renderItem(item, i, itemUpdate, itemPath, alive)}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <button ref={addRef} type="button" className={`${secondaryButton} mt-3`} onClick={add}>
        + Add {noun}
      </button>
    </section>
  );
}
