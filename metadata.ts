import { PageMetadata } from "./types.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { normalizeUrl, isSameDomain } from "./utils/url.ts";
import { suggestTitleDescriptionKeywords } from "./openai.ts";

export async function extractMetadata({ url, depth, sitemapData, sitemapUrls, openai, options, baseHostname }: {
  url: string;
  depth: number;
  sitemapData?: { lastmod: string | null; priority: string | null; changefreq: string | null };
  sitemapUrls: { url: string }[];
  openai: any;
  options: { userAgent: string; timeout: number };
  baseHostname: string;
}): Promise<PageMetadata> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);
    const response = await fetch(url, {
      headers: { "User-Agent": options.userAgent },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) throw new Error("Failed to parse HTML");
    const title = doc.querySelector("title")?.textContent?.trim() || "";
    const description = doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";
    const keywords = doc.querySelector('meta[name="keywords"]')?.getAttribute("content") || "";
    const h1Elements = doc.querySelectorAll("h1");
    const h1Count = h1Elements.length;
    const h1Text = h1Elements[0]?.textContent?.trim() || "";
    const canonicalUrl = doc.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
    const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
    const ogDescription = doc.querySelector('meta[property="og:description"]')?.getAttribute("content") || "";
    const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";
    const twitterCard = doc.querySelector('meta[name="twitter:card"]')?.getAttribute("content") || "";
    const twitterTitle = doc.querySelector('meta[name="twitter:title"]')?.getAttribute("content") || "";
    const twitterDescription = doc.querySelector('meta[name="twitter:description"]')?.getAttribute("content") || "";
    const twitterImage = doc.querySelector('meta[name="twitter:image"]')?.getAttribute("content") || "";
    const robots = doc.querySelector('meta[name="robots"]')?.getAttribute("content") || "";
    const titleLength = title.length;
    const descriptionLength = description.length;
    const keywordsCount = keywords ? keywords.split(",").length : 0;
    const links: string[] = [];
    const linkElements = doc.querySelectorAll("a[href]");
    for (let i = 0; i < linkElements.length; i++) {
      const href = linkElements[i].getAttribute("href");
      if (href) {
        const normalized = normalizeUrl(href, url);
        if (normalized && isSameDomain(normalized, baseHostname) && !normalized.includes("mailto:")) {
          links.push(normalized);
        }
      }
    }
    const titleScore = titleLength > 10 && titleLength < 70 ? "good" : "needs improvement";
    const descriptionScore = descriptionLength > 50 && descriptionLength < 160 ? "good" : "needs improvement";
    const keywordsScore = keywordsCount > 0 && keywordsCount < 10 ? "good" : "needs improvement";
    const h1Score = h1Count === 1 ? "good" : "needs improvement";
    const inSitemap = sitemapUrls.some((item) => item.url === url);
    let suggestedTitle: string | undefined = undefined;
    let suggestedDescription: string | undefined = undefined;
    let suggestedKeywords: string | undefined = undefined;
    if (titleScore === "needs improvement" || descriptionScore === "needs improvement" || keywordsScore === "needs improvement") {
      const suggestions = await suggestTitleDescriptionKeywords({
        html,
        url,
        currentTitle: title,
        currentDescription: description,
        currentKeywords: keywords,
        openai,
      });
      suggestedTitle = suggestions.suggestedTitle;
      suggestedDescription = suggestions.suggestedDescription;
      suggestedKeywords = suggestions.suggestedKeywords;
    }
    return {
      url,
      title,
      titleLength,
      titleScore,
      description,
      descriptionLength,
      descriptionScore,
      keywords,
      keywordsCount,
      keywordsScore,
      h1Count,
      h1Score,
      h1Text,
      canonicalUrl,
      ogTitle,
      ogDescription,
      ogImage,
      twitterCard,
      twitterTitle,
      twitterDescription,
      twitterImage,
      robots,
      depth,
      links,
      inSitemap,
      lastmod: sitemapData?.lastmod || null,
      priority: sitemapData?.priority || null,
      changefreq: sitemapData?.changefreq || null,
      suggestedTitle,
      suggestedDescription,
      suggestedKeywords,
      html,
    };
  } catch (error) {
    const message = typeof error === "object" && error && "message" in error ? (error as any).message : String(error);
    return {
      url,
      title: "",
      titleLength: 0,
      titleScore: "needs improvement",
      description: "",
      descriptionLength: 0,
      descriptionScore: "needs improvement",
      keywords: "",
      keywordsCount: 0,
      keywordsScore: "needs improvement",
      h1Count: 0,
      h1Score: "needs improvement",
      h1Text: "",
      canonicalUrl: "",
      ogTitle: "",
      ogDescription: "",
      ogImage: "",
      twitterCard: "",
      twitterTitle: "",
      twitterDescription: "",
      twitterImage: "",
      robots: "",
      depth,
      links: [],
      inSitemap: false,
      error: message,
    };
  }
} 