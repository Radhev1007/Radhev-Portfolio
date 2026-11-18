"use client";

import { useId, useRef, useState } from "react";
import { uploadImage } from "./api";
import { ACCEPTED_TYPES, prepareImage } from "./downscale";
import { fieldId, useFieldError } from "./errors";
import { TextAreaField, TextField, secondaryButton } from "./fields";
import { useAdminSession } from "./session";

type Status = { tone: "info" | "error" | "success"; text: string } | null;

/**
 * An image with its alt text: a fixed-size preview (so nothing jumps when it loads), an upload that
 * shrinks the file in the browser first (see downscale.ts), the URL as an editable text field (paths
 * starting with "/" point at files shipped with the site), and a Remove button.
 */
export function ImageField({
  path,
  altPath,
  label,
  image,
  alt,
  setImage,
  setAlt,
  alive,
}: {
  path: string;
  altPath: string;
  label: string;
  image: string | undefined;
  alt: string | undefined;
  /** Functional setters bound to the owning item by its stable key, so a late upload writes only `image`. */
  setImage: (url: string | undefined) => void;
  setAlt: (alt: string | undefined) => void;
  /** Whether the owning item still exists when the upload completes. */
  alive: () => boolean;
}) {
  const { onUnauthorized, imagesConfigured, trackUpload, notify } = useAdminSession();
  const errors = useFieldError();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [broken, setBroken] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uid = useId();
  const fileId = `${fieldId(path)}-file`;
  const statusId = `${uid}-status`;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const done = trackUpload();
    let result: Awaited<ReturnType<typeof uploadImage>>;
    try {
      setStatus({ tone: "info", text: "Preparing the image…" });
      const prepared = await prepareImage(file);
      if (!prepared.ok) {
        setStatus({ tone: "error", text: prepared.message });
        return;
      }
      setStatus({ tone: "info", text: `${prepared.note ? `${prepared.note} ` : ""}Uploading…` });
      result = await uploadImage(prepared.blob, prepared.name);
    } finally {
      setBusy(false);
      done();
      if (fileRef.current) fileRef.current.value = "";
    }
    if (result.kind === "unauthorized") {
      setStatus({ tone: "error", text: "Your session has ended. Sign in again, then upload the image again." });
      onUnauthorized();
      return;
    }
    if (result.kind !== "ok") {
      setStatus({ tone: "error", text: result.kind === "error" ? result.message : "The upload failed." });
      return;
    }
    if (!alive()) {
      // This field has unmounted with its item, so the message goes to the save bar.
      notify("An image finished uploading after its item was removed, so it was not used.");
      return;
    }
    if (errors.get(path)) errors.clear(path);
    setBroken(null);
    setImage(result.url);
    setStatus({ tone: "success", text: "Uploaded. Save to publish the new image." });
  };

  const statusClass =
    status?.tone === "error" ? "text-red-800" : status?.tone === "success" ? "text-green-800" : "text-neutral-700";

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
        <div
          className="flex aspect-[4/3] w-full max-w-64 items-center justify-center overflow-hidden rounded-md border border-neutral-300 bg-neutral-100"
          aria-hidden={image ? undefined : true}
        >
          {image && broken !== image ? (
            // A plain <img>: the URL can be any stored path or Blob URL, and this is a preview only.
            <img
              src={image}
              alt={alt ? `Preview: ${alt}` : `Preview of ${label.toLowerCase()}`}
              className="size-full object-contain"
              onError={() => setBroken(image)}
            />
          ) : (
            <span className="px-3 text-center text-sm text-neutral-600">
              {image ? "The preview could not load. Check the URL." : "No image"}
            </span>
          )}
        </div>
        <div className="grid min-w-0 content-start gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={fileId} className="text-sm font-semibold text-neutral-900">
              Upload a new {label.toLowerCase()}
            </label>
            <p id={`${fileId}-hint`} className="text-sm text-neutral-600">
              JPEG, PNG or WebP. Large photos are shrunk to 1600 px wide before upload.
              {!imagesConfigured && " Image storage (Vercel Blob) is not connected yet, so uploads will fail; you can still type a path such as /projects/cover.webp below."}
            </p>
            <input
              ref={fileRef}
              id={fileId}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              disabled={busy}
              aria-describedby={`${fileId}-hint ${statusId}`}
              className="block w-full min-h-11 max-w-full text-sm text-neutral-900 file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-md file:border file:border-neutral-400 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-neutral-100"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <p id={statusId} role="status" aria-live="polite" className={`min-h-5 text-sm font-medium ${statusClass}`}>
              {status?.text}
            </p>
          </div>
          {image && (
            <div>
              <button
                type="button"
                className={secondaryButton}
                onClick={() => {
                  setImage(undefined);
                  setStatus({ tone: "info", text: "Image removed. Save to publish." });
                }}
              >
                Remove image
              </button>
            </div>
          )}
        </div>
      </div>
      <TextField
        path={path}
        label={`${label} URL`}
        hint='Filled in by an upload. Only a path starting with "/" (a file shipped with the site) or an image uploaded here is accepted; links to other websites are not.'
        value={image ?? ""}
        onChange={(v) => setImage(v.trim() === "" ? undefined : v)}
      />
      <TextAreaField
        path={altPath}
        label="Alt text"
        hint="Describe what the image shows for people who cannot see it."
        rows={2}
        value={alt ?? ""}
        onChange={(v) => setAlt(v === "" ? undefined : v)}
      />
    </div>
  );
}
