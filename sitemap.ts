import { SitemapUrl } from "./types.ts";

// Fetch a URL and get the response text
async function fetchUrl(url: string, options: { userAgent: string; timeout: number }): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": options.userAgent,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

import { parse as parseXml } from "https://deno.land/x/xml/mod.ts";

export async function parseSitemap(url: string, options: { userAgent: string; timeout: number }): Promise<SitemapUrl[]> {
  try {
    const text = await fetchUrl(url, options);
    if (!text.trim().startsWith("<?xml")) {
      return [];
    }
    const parsed = parseXml(text);
    let urls: SitemapUrl[] = [];
    if (
      parsed.sitemapindex &&
      typeof parsed.sitemapindex === "object" &&
      "sitemap" in parsed.sitemapindex
    ) {
      const sitemapsRaw = parsed.sitemapindex.sitemap;
      const sitemaps = Array.isArray(sitemapsRaw) ? sitemapsRaw : [sitemapsRaw];
      for (const sitemap of sitemaps) {
        if (sitemap && typeof sitemap === "object" && "loc" in sitemap) {
          const loc = typeof sitemap.loc === "string" ? sitemap.loc : sitemap.loc?._text;
          if (loc) {
            const childUrls = await parseSitemap(loc, options);
            urls = urls.concat(childUrls);
          }
        }
      }
    } else if (
      parsed.urlset &&
      typeof parsed.urlset === "object" &&
      "url" in parsed.urlset
    ) {
      const urlsRaw = parsed.urlset.url;
      const sitemap_urls = Array.isArray(urlsRaw) ? urlsRaw : [urlsRaw];
      for (const urlObj of sitemap_urls) {
        if (urlObj && typeof urlObj === "object" && "loc" in urlObj) {
          const loc = typeof urlObj.loc === "string" ? urlObj.loc : urlObj.loc?._text;
          if (loc) {
            urls.push({
              url: loc,
              lastmod: urlObj.lastmod ? (typeof urlObj.lastmod === "string" ? urlObj.lastmod : urlObj.lastmod._text) : null,
              priority: urlObj.priority ? (typeof urlObj.priority === "string" ? urlObj.priority : urlObj.priority._text) : null,
              changefreq: urlObj.changefreq ? (typeof urlObj.changefreq === "string" ? urlObj.changefreq : urlObj.changefreq._text) : null,
            });
          }
        }
      }
    }
    return urls;
  } catch (error) {
    return [];
  }
} 