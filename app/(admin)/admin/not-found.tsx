/**
 * 404 for unknown URLs under /admin (see [...rest]/page.tsx). Rendered inside the admin layout, so it is
 * plain and light like the rest of the admin rather than the portfolio's 404. A plain <a> (not <Link>)
 * because /admin is rendered per request and should reload with the current session.
 */
export default function AdminNotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-[100svh] w-full max-w-md flex-col justify-center gap-3 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-normal text-neutral-900">Page not found</h1>
      <p className="text-neutral-700">There is nothing at this address in the admin.</p>
      <p>
        <a href="/admin" className="inline-flex min-h-11 items-center text-blue-800 underline underline-offset-2">
          Go to the content editor
        </a>
      </p>
    </main>
  );
}
