/** Shown instead of the login form when the admin's environment variables are missing (server component). */
export function NotConfigured() {
  return (
    <main id="main" className="mx-auto flex min-h-[100svh] w-full max-w-xl flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-normal text-neutral-900">The admin is not set up yet</h1>
      <div className="mt-4 grid gap-3 rounded-lg border-2 border-amber-600 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950">
        <p>Signing in needs two environment variables on the server:</p>
        <ul className="list-disc pl-5">
          <li>
            <code className="font-mono">ADMIN_PASSWORD</code>: the password you will sign in with.
          </li>
          <li>
            <code className="font-mono">ADMIN_SESSION_SECRET</code>: a long random string (at least 32 characters).
          </li>
        </ul>
        <p>
          Add them in the Vercel project&apos;s settings (Environment Variables), redeploy, then reload this page. To save
          content you also need a Neon Postgres database (<code className="font-mono">DATABASE_URL</code>), and to upload
          images a Vercel Blob store (<code className="font-mono">BLOB_READ_WRITE_TOKEN</code>).
        </p>
        <p>Until then the site keeps showing the content built into its code.</p>
      </div>
    </main>
  );
}
