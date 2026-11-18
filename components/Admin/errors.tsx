"use client";

import { createContext, useContext } from "react";

/**
 * Field-level validation messages, keyed by the server's issue path (`projects.2.slug`, `site.name.first`,
 * `projects.0.story.tools.1`). Every field takes the same path and looks up its own message, so a 400
 * from PUT /api/admin/content lands next to the right input with no per-field wiring.
 */
export type ErrorsApi = {
  get(path: string): string | undefined;
  /** Whether any message sits under `prefix` (flags a collapsed item that holds an error). */
  hasUnder(prefix: string): boolean;
  /** Drop one field's message (the owner has edited it). */
  clear(path: string): void;
  /** Drop every message under a list (its items moved, so index-based paths no longer point at them). */
  clearUnder(path: string): void;
};

const noop: ErrorsApi = { get: () => undefined, hasUnder: () => false, clear: () => {}, clearUnder: () => {} };

export const ErrorsContext = createContext<ErrorsApi>(noop);

export const useFieldError = () => useContext(ErrorsContext);

/** DOM id for a field path: `projects.2.slug` -> `f-projects-2-slug`. */
export const fieldId = (path: string) => `f-${path.replace(/[^a-zA-Z0-9]+/g, "-")}`;
