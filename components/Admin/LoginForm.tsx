"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { primaryButton, inputClass } from "./fields";

/**
 * The password form. `onSubmit` performs the sign-in (and any follow-up load) and resolves to an error
 * message, or null on success.
 */
export function LoginForm({
  onSubmit,
  intro,
}: {
  onSubmit: (password: string) => Promise<string | null>;
  intro?: string;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const errorId = `${id}-error`;

  useEffect(() => inputRef.current?.focus(), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!password) {
      setError("Enter the admin password.");
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    const message = await onSubmit(password);
    setBusy(false);
    if (message) {
      setError(message);
      inputRef.current?.select();
      inputRef.current?.focus();
    }
  };

  return (
    <main id="main" className="mx-auto flex min-h-[100svh] w-full max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-normal text-neutral-900">Sign in to edit the site</h1>
      {intro && <p className="mt-2 rounded-lg border border-amber-600 bg-amber-50 p-3 text-sm text-amber-950">{intro}</p>}
      <form onSubmit={submit} noValidate className="mt-6 grid gap-4 rounded-lg border border-neutral-300 bg-white p-5">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-password`} className="text-sm font-semibold text-neutral-900">
            Password
          </label>
          <input
            ref={inputRef}
            id={`${id}-password`}
            name="password"
            type="password"
            autoComplete="current-password"
            className={inputClass}
            value={password}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p id={errorId} role="alert" className="min-h-5 text-sm font-medium text-red-800">
            {error}
          </p>
        </div>
        <button type="submit" className={primaryButton} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
