// HTML utility functions

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c));
}

import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

/**
 * Extracts visible text content from HTML, removing all tags, scripts, and styles.
 */
export function extractTextFromHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return "";
  // Remove script and style elements
  doc.querySelectorAll("script,style,noscript").forEach(el => el.remove());
  // Get all text content
  return doc.body?.textContent?.replace(/\s+/g, " ").trim() || "";
} 