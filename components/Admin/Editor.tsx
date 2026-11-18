"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ContentData } from "@/lib/content";
import { field, type Updater } from "@/lib/admin/updaters";
import { logout, resetContent, saveContent, type Issue, type LoadedContent } from "./api";
import { ErrorsContext, fieldId, type ErrorsApi } from "./errors";
import { dangerButton, primaryButton, secondaryButton } from "./fields";
import { IssueSummary } from "./IssueSummary";
import { ExperienceSection } from "./sections/ExperienceSection";
import { ProcessSection } from "./sections/ProcessSection";
import { ProjectsSection } from "./sections/ProjectsSection";
import { SiteSection } from "./sections/SiteSection";
import { SpecialismsSection } from "./sections/SpecialismsSection";
import { SessionContext } from "./session";

const SECTIONS = [
  { id: "site", label: "Site info", root: "site" },
  { id: "projects", label: "Projects", root: "projects" },
  { id: "experience", label: "Experience", root: "experience" },
  { id: "specialisms", label: "Specialisms", root: "specialisms" },
  { id: "process", label: "Process", root: "processSteps" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

const sectionFor = (path: string): SectionId =>
  SECTIONS.find((s) => path === s.root || path.startsWith(`${s.root}.`))?.id ?? "site";

type Status = { tone: "info" | "success" | "error"; text: string } | null;

export function Editor({
  initial,
  dbConfigured,
  imagesConfigured,
  onUnauthorized,
  notice,
  active,
}: {
  initial: LoadedContent;
  dbConfigured: boolean;
  imagesConfigured: boolean;
  onUnauthorized: () => void;
  /** A one-off message from the shell (e.g. "signed in again"). */
  notice?: string | null;
  /** False while the login form is showing (after a 401): Save and Ctrl/Cmd+S do nothing. */
  active: boolean;
}) {
  const [content, setContent] = useState<ContentData>(initial.content);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initial.content));
  const [source, setSource] = useState(initial.source);
  const [section, setSection] = useState<SectionId>("site");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [errorMap, setErrorMap] = useState<Map<string, string>>(new Map());
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState<"save" | "reset" | "logout" | null>(null);
  const [, bump] = useState(0);
  const [uploads, setUploads] = useState(0);
  /** Bumped when the content is replaced wholesale; remounts the section editors (fresh list keys). */
  const [generation, setGeneration] = useState(0);

  const summaryRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const leaving = useRef(false);
  /** A field to focus once its section has rendered (set by the issue summary). */
  const focusAfterRender = useRef<string | null>(null);
  const focusHeading = useRef(false);
  const focusSummary = useRef(false);

  const dirty = useMemo(() => JSON.stringify(content) !== savedJson, [content, savedJson]);

  // A fresh notice from the shell (e.g. signed in again) replaces a stale status line.
  useEffect(() => {
    if (notice) setStatus(null);
  }, [notice]);

  // Warn before the tab closes or reloads with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (leaving.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const errors = useMemo<ErrorsApi>(
    () => ({
      get: (p) => errorMap.get(p),
      hasUnder: (prefix) => {
        for (const k of errorMap.keys()) if (k.startsWith(`${prefix}.`)) return true;
        return false;
      },
      clear: (p) =>
        setErrorMap((m) => {
          if (!m.has(p)) return m;
          const n = new Map(m);
          n.delete(p);
          return n;
        }),
      clearUnder: (prefix) => {
        // Items moved or were removed: index-based paths under this list no longer point at them.
        const stale = (k: string) => k.startsWith(`${prefix}.`);
        setErrorMap((m) => {
          const n = new Map([...m].filter(([k]) => !stale(k)));
          return n.size === m.size ? m : n;
        });
        setIssues((list) => (list.some((i) => stale(i.path)) ? list.filter((i) => !stale(i.path)) : list));
      },
    }),
    [errorMap],
  );

  const trackUpload = useCallback(() => {
    setUploads((n) => n + 1);
    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      setUploads((n) => n - 1);
    };
  }, []);
  const notify = useCallback((text: string) => setStatus({ tone: "info", text }), []);
  const session = useMemo(
    () => ({ onUnauthorized, imagesConfigured, trackUpload, notify }),
    [onUnauthorized, imagesConfigured, trackUpload, notify],
  );

  // Functional updaters: every write applies to the latest content, never to a copy from an older render.
  const update = useCallback<Updater<ContentData>>((fn) => setContent(fn), []);

  // Focus management after a section switch or a jump from the issue summary.
  useEffect(() => {
    if (focusSummary.current && summaryRef.current) {
      focusSummary.current = false;
      summaryRef.current.scrollIntoView({ block: "nearest" });
      summaryRef.current.focus({ preventScroll: true });
      return;
    }
    const path = focusAfterRender.current;
    if (path) {
      focusAfterRender.current = null;
      const el = document.getElementById(fieldId(path)) ?? findNearest(path);
      if (el) {
        // Open every collapsed item around the field, then bring it into view.
        for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) d.open = true;
        el.scrollIntoView({ block: "center" });
        el.focus({ preventScroll: true });
        return;
      }
      headingRef.current?.focus();
      return;
    }
    if (focusHeading.current) {
      focusHeading.current = false;
      headingRef.current?.focus();
    }
  });

  const switchTo = (id: SectionId) => {
    if (id === section) return;
    setSection(id);
    focusHeading.current = true;
    window.scrollTo({ top: 0 });
  };

  const goToIssue = useCallback((path: string) => {
    setSection(sectionFor(path));
    focusAfterRender.current = path;
    // Force a render even when the section is already showing, so the focus effect runs.
    bump((n) => n + 1);
  }, []);

  const save = useCallback(async () => {
    if (busy || !active || uploads > 0) return;
    setBusy("save");
    setStatus({ tone: "info", text: "Saving…" });
    const snapshot = content;
    const result = await saveContent(snapshot);
    setBusy(null);
    switch (result.kind) {
      case "ok":
        setSavedJson(JSON.stringify(snapshot));
        setSource("database");
        setIssues([]);
        setErrorMap(new Map());
        setStatus({ tone: "success", text: `Saved at ${new Date().toLocaleTimeString()}. The site shows the changes now.` });
        break;
      case "invalid":
        setIssues(result.issues);
        setErrorMap(groupIssues(result.issues));
        setStatus({
          tone: "error",
          text: `Not saved: ${result.issues.length === 1 ? "1 field needs" : `${result.issues.length} fields need`} attention.`,
        });
        focusSummary.current = true;
        break;
      case "unauthorized":
        setStatus({ tone: "error", text: "Not saved: your session has ended. Sign in again; your changes are kept." });
        onUnauthorized();
        break;
      case "error":
        // A 503 or similar comes after validation passed, so earlier field messages no longer apply.
        setIssues([]);
        setErrorMap(new Map());
        setStatus({ tone: "error", text: `Not saved: ${result.message}` });
        break;
    }
  }, [busy, active, uploads, content, onUnauthorized]);

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const reset = async () => {
    const ok = window.confirm(
      "Copy the built-in content into the database?\n\nThis writes the content that ships with the site's code into the database, replacing anything stored there. Your unsaved edits in this editor are kept; save them afterwards if you want them.",
    );
    if (!ok) return;
    setBusy("reset");
    setStatus({ tone: "info", text: "Loading the built-in content into the database…" });
    const result = await resetContent();
    setBusy(null);
    if (result.kind === "ok") {
      setSource("database");
      // The database now holds exactly what was loaded (the defaults), so that is the saved baseline.
      setSavedJson(JSON.stringify(initial.content));
      setStatus({ tone: "success", text: "Done. The database now holds the built-in content; edits you save will update it." });
    } else if (result.kind === "unauthorized") {
      setStatus({ tone: "error", text: "Your session has ended. Sign in again, then try again." });
      onUnauthorized();
    } else {
      setStatus({ tone: "error", text: `Could not load the content: ${result.kind === "error" ? result.message : "the server rejected it."}` });
    }
  };

  const signOut = async () => {
    if (dirty && !window.confirm("You have unsaved changes. Sign out and lose them?")) return;
    setBusy("logout");
    if (!(await logout())) {
      setBusy(null);
      setStatus({ tone: "error", text: "Could not sign out (the server did not respond). Try again." });
      return;
    }
    leaving.current = true;
    window.location.assign("/admin");
  };

  const current = SECTIONS.find((s) => s.id === section)!;
  const statusClass =
    status?.tone === "error" ? "text-red-800" : status?.tone === "success" ? "text-green-800" : "text-neutral-700";

  return (
    <SessionContext.Provider value={session}>
      <ErrorsContext.Provider value={errors}>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-4 pb-32 sm:px-6">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-300 pb-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal text-neutral-900">Site content</h1>
              <p className="text-sm text-neutral-600">
                Edit, then save: the site updates straight away.{" "}
                <a className="text-blue-800 underline underline-offset-2" href="/" target="_blank" rel="noopener">
                  Open the site<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            </div>
            <button type="button" className={secondaryButton} onClick={signOut} disabled={busy === "logout"}>
              Sign out
            </button>
          </header>

          {notice && <p className="rounded-lg border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}

          {!dbConfigured && (
            <div className="rounded-lg border-2 border-amber-600 bg-amber-50 p-4 text-sm text-amber-950">
              <h2 className="text-base font-semibold tracking-normal">No database is connected</h2>
              <p className="mt-1">
                DATABASE_URL is not set, so the site uses the content built into its code and saving will not work. You
                can look through the editor; to save, connect a Neon Postgres database to the Vercel project and redeploy.
              </p>
            </div>
          )}

          {dbConfigured && initial.error && (
            <div className="rounded-lg border-2 border-amber-600 bg-amber-50 p-4 text-sm text-amber-950">
              <h2 className="text-base font-semibold tracking-normal">The database could not be reached</h2>
              <p className="mt-1">
                This editor shows the built-in content, which may not be what is live. Saving now would replace the stored
                content with what you see here. Reload the page to try again.
              </p>
            </div>
          )}

          {dbConfigured && !initial.error && source === "invalid" && (
            <div role="alert" className="rounded-lg border-2 border-amber-600 bg-amber-50 p-4 text-sm text-amber-950">
              <h2 className="text-base font-semibold tracking-normal">The stored content is invalid</h2>
              <p className="mt-1">
                The site is showing the built-in content, and so is this editor. Saving will replace the stored content with
                what you see here.
              </p>
              {initial.issues && initial.issues.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer font-medium">What is wrong with it ({initial.issues.length})</summary>
                  <ul className="mt-1 list-disc pl-5">
                    {initial.issues.slice(0, 20).map((i, n) => (
                      <li key={n}>
                        <code>{i.path || "(document)"}</code>: {i.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {dbConfigured && !initial.error && source === "defaults" && (
            <div className="flex flex-col gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4 text-sm text-blue-950 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-normal">The database is empty</h2>
                <p className="mt-1">
                  The site is showing the content built into its code. Load it into the database to start editing from it;
                  this copies that content in, replacing anything stored there. Saving also stores everything you see here.
                </p>
              </div>
              <button type="button" className={`${primaryButton} shrink-0`} onClick={reset} disabled={busy !== null}>
                Load current content into the database
              </button>
            </div>
          )}

          {issues.length > 0 && <IssueSummary ref={summaryRef} issues={issues} content={content} onGo={goToIssue} />}

          <div className="grid min-w-0 gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
            <nav aria-label="Sections" className="lg:sticky lg:top-4 lg:self-start">
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                {SECTIONS.map((s) => {
                  const active = s.id === section;
                  const hasErrors = [...errorMap.keys()].some((k) => sectionFor(k) === s.id);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        aria-current={active ? "page" : undefined}
                        onClick={() => switchTo(s.id)}
                        className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium ${
                          active
                            ? "border-blue-800 bg-blue-800 text-white"
                            : "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100"
                        }`}
                      >
                        {s.label}
                        {hasErrors && (
                          <span className={`rounded px-1.5 text-xs font-semibold ${active ? "bg-white text-red-800" : "bg-red-100 text-red-800"}`}>
                            !<span className="sr-only"> has errors</span>
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <main id="main" className="min-w-0">
              <h2 ref={headingRef} tabIndex={-1} className="mb-4 text-xl font-semibold tracking-normal text-neutral-900">
                {current.label}
              </h2>
              {/*
                All sections stay mounted (inactive ones hidden) so each list keeps its stable keys across
                section switches and an in-flight upload still lands on its own project. `generation`
                remounts them when the content is replaced wholesale (Discard), so keys line up again.
              */}
              <div key={generation}>
                <div hidden={section !== "site"}>
                  <SiteSection value={content.site} update={field(update, "site")} />
                </div>
                <div hidden={section !== "projects"}>
                  <ProjectsSection value={content.projects} update={field(update, "projects")} />
                </div>
                <div hidden={section !== "experience"}>
                  <ExperienceSection value={content.experience} update={field(update, "experience")} />
                </div>
                <div hidden={section !== "specialisms"}>
                  <SpecialismsSection value={content.specialisms} update={field(update, "specialisms")} />
                </div>
                <div hidden={section !== "process"}>
                  <ProcessSection value={content.processSteps} update={field(update, "processSteps")} />
                </div>
              </div>
            </main>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-300 bg-white/95 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium text-neutral-900">{dirty ? "Unsaved changes" : "No unsaved changes"}</p>
              <p role="status" aria-live="polite" className={`min-h-5 ${statusClass}`}>
                {status?.text}
              </p>
            </div>
            <div className="flex gap-2">
              {dirty && (
                <button
                  type="button"
                  className={dangerButton}
                  disabled={busy !== null || uploads > 0}
                  title={uploads > 0 ? "Wait for the upload to finish" : undefined}
                  onClick={() => {
                    if (uploads > 0) return;
                    if (!window.confirm("Discard all unsaved changes?")) return;
                    setContent(JSON.parse(savedJson) as ContentData);
                    setGeneration((g) => g + 1);
                    setIssues([]);
                    setErrorMap(new Map());
                    setStatus({ tone: "info", text: "Changes discarded." });
                  }}
                >
                  Discard
                </button>
              )}
              <button
                type="button"
                className={primaryButton}
                onClick={save}
                disabled={busy !== null || uploads > 0}
                aria-keyshortcuts="Control+S Meta+S"
              >
                {busy === "save" ? "Saving…" : uploads > 0 ? "Uploading…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </ErrorsContext.Provider>
    </SessionContext.Provider>
  );
}

/** Field messages by path; several issues on one path are all shown, joined. */
function groupIssues(issues: Issue[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const i of issues) {
    const prev = m.get(i.path);
    m.set(i.path, prev && prev !== i.message ? `${prev}; ${i.message}` : i.message);
  }
  return m;
}

/** For an issue on a list or an object (no input of its own), the first input under it. */
function findNearest(path: string): HTMLElement | null {
  const prefix = fieldId(path);
  return document.querySelector<HTMLElement>(`[id^="${prefix}-"]:is(input, textarea, select)`);
}
