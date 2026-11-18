"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ContentData } from "@/lib/content";

/**
 * The site's editable content, loaded once on the server by the (site) layout
 * (`await getContent()`) and handed to client components through context.
 */
const ContentContext = createContext<ContentData | null>(null);

export function ContentProvider({ content, children }: { content: ContentData; children: ReactNode }) {
  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
}

export function useContent(): ContentData {
  const content = useContext(ContentContext);
  if (!content) throw new Error("useContent must be used inside <ContentProvider>");
  return content;
}
