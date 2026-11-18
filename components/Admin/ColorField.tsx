"use client";

import { fieldId, useFieldError } from "./errors";
import { inputClass } from "./fields";

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * A #RRGGBB colour: a text box (the source of truth, so any value can be typed or pasted) beside the
 * native picker. The picker only accepts a valid hex, so it shows the last valid colour while the text is
 * being typed. Invalid text is flagged here at once; the server checks again on save.
 */
export function ColorField({
  path,
  label,
  value,
  onChange,
}: {
  path: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const errors = useFieldError();
  const id = fieldId(path);
  const valid = HEX.test(value);
  const error = errors.get(path) ?? (valid ? undefined : "Use a #RRGGBB colour, e.g. #1F2A44");
  const errorId = `${id}-error`;
  const set = (v: string) => {
    if (errors.get(path)) errors.clear(path);
    onChange(v);
  };
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-neutral-900">
        {label}
      </label>
      <div className="flex min-w-0 items-center gap-2">
        <input
          type="color"
          className="h-11 w-14 shrink-0 cursor-pointer rounded-md border border-neutral-400 bg-white p-1"
          aria-label={`${label} picker`}
          value={valid ? value.toLowerCase() : "#000000"}
          onChange={(e) => set(e.target.value.toUpperCase())}
        />
        <input
          id={id}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={7}
          className={`${inputClass} font-mono`}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => set(e.target.value.trim())}
        />
      </div>
      {error && (
        <p id={errorId} className="text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
