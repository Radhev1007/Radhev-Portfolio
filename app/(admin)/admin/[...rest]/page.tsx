import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Page not found · Content admin" };

/**
 * Catches every unknown path under /admin so it renders the admin's own 404 (../not-found.tsx) inside
 * the admin layout, instead of the root 404, which wraps the page in the portfolio's chrome.
 */
export default function AdminUnknown() {
  notFound();
}
