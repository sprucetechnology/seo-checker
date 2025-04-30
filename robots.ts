import { CrawlOptions } from "./types.ts";

export async function getSitemapFromRobots(baseUrl: string, options: CrawlOptions): Promise<string | null> {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).href;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);
    const res = await fetch(robotsUrl, {
      headers: { "User-Agent": options.userAgent },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const text = await res.text();
    const match = text.match(/^sitemap:\s*(.+)$/gim);
    if (match && match.length > 0) {
      // Use the first sitemap found
      const sitemapLine = match[0];
      const sitemapUrl = sitemapLine.split(/sitemap:/i)[1].trim();
      return sitemapUrl;
    }
    return null;
  } catch (_) {
    return null;
  }
} 