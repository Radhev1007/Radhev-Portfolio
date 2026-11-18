"use client";

import { useCallback, useState } from "react";
import { loadContent, login, type LoadedContent } from "./api";
import { Editor } from "./Editor";
import { LoginForm } from "./LoginForm";

/**
 * Client shell for /admin. The server page decides the first view (signed in or not); after that this
 * component owns it. A 401 from any call shows the login form again WITHOUT unmounting the editor, so
 * unsaved edits survive an expired session.
 */
export function AdminApp({
  initial,
  dbConfigured,
  imagesConfigured,
}: {
  /** The content when the visitor is already signed in, else null. */
  initial: LoadedContent | null;
  dbConfigured: boolean;
  imagesConfigured: boolean;
}) {
  const [data, setData] = useState<LoadedContent | null>(initial);
  const [db, setDb] = useState(dbConfigured);
  const [signedIn, setSignedIn] = useState(initial !== null);
  const [expired, setExpired] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const onUnauthorized = useCallback(() => {
    setSignedIn(false);
    setExpired(true);
    setNotice(null);
  }, []);

  const signIn = async (password: string): Promise<string | null> => {
    const result = await login(password);
    if (result.kind !== "ok") return result.kind === "error" ? result.message : "Sign-in failed.";
    if (data) {
      setNotice(expired ? "Signed in again. Your unsaved changes are still here; save when ready." : null);
      setSignedIn(true);
      return null;
    }
    const loaded = await loadContent();
    if (loaded.kind !== "ok") {
      return loaded.kind === "error" ? `Signed in, but ${loaded.message.charAt(0).toLowerCase()}${loaded.message.slice(1)}` : "Sign-in did not stick. Try again.";
    }
    setDb(loaded.configured);
    setData({ content: loaded.content, source: loaded.source, error: loaded.error });
    setSignedIn(true);
    return null;
  };

  return (
    <>
      {!signedIn && (
        <LoginForm
          onSubmit={signIn}
          intro={expired ? "Your session has ended. Sign in again to carry on; your unsaved changes are kept." : undefined}
        />
      )}
      {data && (
        <div hidden={!signedIn}>
          <Editor
            initial={data}
            dbConfigured={db}
            imagesConfigured={imagesConfigured}
            onUnauthorized={onUnauthorized}
            notice={notice}
            active={signedIn}
          />
        </div>
      )}
    </>
  );
}
