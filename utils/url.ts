// URL utility functions

import { CrawlOptions } from "../types.ts";

export function normalizeUrl(url: string, base: string): string | null {
  try {
    const resolvedUrl = new URL(url, base);
    // Remove trailing slash and hash
    return resolvedUrl.href.replace(/#.*$/, "").replace(/\/$/, "");
  } catch (e) {
    return null;
  }
}

export function isSameDomain(url: string, baseHostname: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname === baseHostname;
  } catch (e) {
    return false;
  }
}

export function getCacheFilenameFromUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
  } catch {
    return 'site-cache';
  }
} 