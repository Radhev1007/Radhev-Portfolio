"use client";

import { createContext, useContext } from "react";

/** What deep fields (e.g. the image uploader) need from the editor shell. */
export type AdminSession = {
  /** Called when any API call answers 401: the editor shows the login form and keeps the draft. */
  onUnauthorized: () => void;
  /** BLOB_READ_WRITE_TOKEN is set, so uploads can be stored. */
  imagesConfigured: boolean;
  /** Marks an upload as in flight (Save is disabled meanwhile); call the returned function when it ends. */
  trackUpload: () => () => void;
  /** Shows a message in the save bar (for results whose own field has gone, e.g. a removed item). */
  notify: (text: string) => void;
};

export const SessionContext = createContext<AdminSession>({
  onUnauthorized: () => {},
  imagesConfigured: false,
  trackUpload: () => () => {},
  notify: () => {},
});

export const useAdminSession = () => useContext(SessionContext);
