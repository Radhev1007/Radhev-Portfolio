"use client";

import type { ReactNode } from "react";
import { fieldId, useFieldError } from "./errors";

/** Shared classes so every control looks and focuses the same. */
export const inputClass =
  "block w-full min-h-11 rounded-md border border-neutral-400 bg-white px-3 py-2 text-base text-neutral-900 " +
  "placeholder:text-neutral-500 aria-[invalid=true]:border-red-700 aria-[invalid=true]:bg-red-50";

export const buttonClass =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButton = `${buttonClass} border-blue-800 bg-blue-800 text-white hover:bg-blue-900`;
export const secondaryButton = `${buttonClass} border-neutral-400 bg-white text-neutral-900 hover:bg-neutral-100`;
export const dangerButton = `${buttonClass} border-red-700 bg-white text-red-800 hover:bg-red-50`;

type Common = {
  /** The content path (matches the server's issue paths); also yields the input id. */
  path: string;
  label: string;
  hint?: ReactNode;
};

/** Label, hint and error around one control, with the ids wired for aria-describedby. */
function FieldShell({
  path,
  label,
  hint,
  error,
  children,
}: Common & { error?: string; children: (ids: { id: string; describedBy?: string }) => ReactNode }) {
  const id = fieldId(path);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-neutral-900">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm text-neutral-600">
          {hint}
        </p>
      )}
      {children({ id, describedBy })}
      {error && (
        <p id={errorId} className="text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  value,
  onChange,
  type = "text",
  autoComplete,
  ...common
}: Common & {
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "email" | "url" | "tel";
  autoComplete?: string;
}) {
  const errors = useFieldError();
  const error = errors.get(common.path);
  return (
    <FieldShell {...common} error={error}>
      {({ id, describedBy }) => (
        <input
          id={id}
          type={type}
          className={inputClass}
          value={value}
          autoComplete={autoComplete ?? "off"}
          spellCheck={type === "text"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            if (error) errors.clear(common.path);
            onChange(e.target.value);
          }}
        />
      )}
    </FieldShell>
  );
}

export function TextAreaField({
  value,
  onChange,
  rows = 4,
  ...common
}: Common & { value: string; onChange: (v: string) => void; rows?: number }) {
  const errors = useFieldError();
  const error = errors.get(common.path);
  return (
    <FieldShell {...common} error={error}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          rows={rows}
          className={`${inputClass} resize-y leading-relaxed`}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            if (error) errors.clear(common.path);
            onChange(e.target.value);
          }}
        />
      )}
    </FieldShell>
  );
}

export function SelectField({
  value,
  onChange,
  options,
  ...common
}: Common & { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const errors = useFieldError();
  const error = errors.get(common.path);
  // Keep an unknown stored value selectable rather than silently replacing it.
  const all = options.some((o) => o.value === value) ? options : [{ value, label: `${value} (unknown)` }, ...options];
  return (
    <FieldShell {...common} error={error}>
      {({ id, describedBy }) => (
        <select
          id={id}
          className={inputClass}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            if (error) errors.clear(common.path);
            onChange(e.target.value);
          }}
        >
          {all.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

export function CheckboxField({
  path,
  label,
  hint,
  checked,
  onChange,
}: Common & { checked: boolean; onChange: (v: boolean) => void }) {
  const errors = useFieldError();
  const error = errors.get(path);
  const id = fieldId(path);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-h-11 items-center gap-3">
        <input
          id={id}
          type="checkbox"
          className="size-5 shrink-0 accent-blue-800"
          checked={checked}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
          onChange={(e) => {
            if (error) errors.clear(path);
            onChange(e.target.checked);
          }}
        />
        <label htmlFor={id} className="text-sm font-semibold text-neutral-900">
          {label}
        </label>
      </div>
      {hint && (
        <p id={hintId} className="text-sm text-neutral-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

/** A titled group of fields. */
export function FieldGroup({ title, children, description }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 rounded-lg border border-neutral-300 bg-white p-4 sm:p-5">
      <legend className="px-1 text-base font-semibold text-neutral-900">{title}</legend>
      {description && <p className="mb-3 text-sm text-neutral-600">{description}</p>}
      <div className="grid min-w-0 gap-4">{children}</div>
    </fieldset>
  );
}

/** Two columns from tablet width up. */
export function Row({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 gap-4 sm:grid-cols-2">{children}</div>;
}
