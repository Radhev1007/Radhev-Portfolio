import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { isAdmin } from "@/lib/admin/auth";
import { csrfRejection } from "@/lib/admin/csrf";
import { ImageError, MAX_IMAGE_BYTES, processImage } from "@/lib/admin/image";

export const runtime = "nodejs";

// Multipart framing overhead allowance on top of the file limit.
const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

function sanitiseName(name: string): string {
  const base = name.replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "");
  const clean = base
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
  return clean || "image";
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  const rejected = csrfRejection(request);
  if (rejected) return rejected;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ message: "Image storage is not configured." }, { status: 503 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ message: "Image is too large (max 8 MB)." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: "Invalid upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ message: "Image is too large (max 8 MB)." }, { status: 400 });
  }

  let processed;
  try {
    processed = await processImage(Buffer.from(await file.arrayBuffer()), file.type);
  } catch (err) {
    if (err instanceof ImageError) {
      return NextResponse.json({ message: err.message }, { status: 400 });
    }
    return NextResponse.json({ message: "Could not process image." }, { status: 400 });
  }

  try {
    const blob = await put(
      `uploads/${Date.now()}-${sanitiseName(file.name)}.webp`,
      processed.buffer,
      { access: "public", contentType: "image/webp", addRandomSuffix: true },
    );
    return NextResponse.json({ url: blob.url });
  } catch {
    return NextResponse.json({ message: "Upload to storage failed." }, { status: 502 });
  }
}
