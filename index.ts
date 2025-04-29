#!/usr/bin/env -S deno run --allow-net --allow-write --allow-read

import { parse as parseFlags } from "https://deno.land/std/flags/mod.ts";
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import * as colors from "https://deno.land/std/fmt/colors.ts";
import * as path from "https://deno.land/std/path/mod.ts";
import { parse as parseXml } from "https://deno.land/x/xml/mod.ts";
import { Table } from "https://deno.land/x/cliffy@v1.0.0-rc.4/table/mod.ts";

// Define types
interface CrawlOptions {
  url: string;
  sitemap: string | null;
  depth: number;
  output: string;
  format: "json" | "csv" | "html";
  limit: number;
  timeout: number;
  concurrency: number;
  userAgent: string;
  sitemapOnly: boolean;
  followLinks: boolean;
  force: boolean;
}

interface QueueItem {
  url: string;
  depth: number;
  sitemapData?: {
    lastmod: string | null;
    priority: string | null;
    changefreq: string | null;
  };
}

interface PageMetadata {
  url: string;
  title: string;
  titleLength: number;
  titleScore: string;
  description: string;
  descriptionLength: number;
  descriptionScore: string;
  keywords: string;
  keywordsCount: number;
  keywordsScore: string;
  h1Count: number;
  h1Score: string;
  h1Text: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  robots: string;
  depth: number;
  links: string[];
  inSitemap: boolean;
  lastmod?: string | null;
  priority?: string | null;
  changefreq?: string | null;
  error?: string;
}

interface SitemapUrl {
  url: string;
  lastmod: string | null;
  priority: string | null;
  changefreq: string | null;
}

interface ReportSummary {
  totalPages: number;
  pagesWithTitle: number;
  pagesWithDescription: number;
  pagesWithKeywords: number;
  pagesWithH1: number;
  pagesWithCanonical: number;
  pagesWithOgTags: number;
  pagesWithTwitterTags: number;
  pagesWithTitleIssues: number;
  pagesWithDescriptionIssues: number;
  pagesWithH1Issues: number;
  pagesWithErrors: number;
  titleCompleteness: number;
  descriptionCompleteness: number;
  keywordsCompleteness: number;
  h1Completeness: number;
  canonicalCompleteness: number;
  pagesInSitemap: number;
  pagesNotInSitemap: number;
}

// Parse command line arguments
const flags = parseFlags(Deno.args, {
  string: ["url", "sitemap", "output", "format", "user-agent"],
  boolean: ["sitemap-only", "follow-links", "help", "force"],
  default: {
    depth: 3,
    output: "seo-report",
    format: "csv",
    limit: 100,
    timeout: 10000,
    concurrency: 5,
    "user-agent": "SEO-Metadata-Crawler/1.0 (Deno)",
    "follow-links": true,
    "sitemap-only": false,
    force: false,
  },
  alias: {
    u: "url",
    s: "sitemap",
    d: "depth",
    o: "output",
    f: "format",
    l: "limit",
    t: "timeout",
    c: "concurrency",
    h: "help",
    F: "force",
  },
});

// Show help
if (flags.help) {
  console.log(`
${colors.bold("SEO Metadata Crawler")}

A tool to crawl a website and analyze its SEO metadata.

${colors.bold("USAGE:")}
  ./index.ts --url <url> [options]

${colors.bold("OPTIONS:")}
  -u, --url <url>              URL to crawl (required)
  -s, --sitemap <url>          Sitemap URL (will use /sitemap.xml if not provided)
  -d, --depth <number>         Maximum crawl depth (default: 3)
  -o, --output <filename>      Output filename (default: 'seo-report')
  -f, --format <format>        Output format (csv, json, html) (default: 'csv')
  -l, --limit <number>         Maximum pages to crawl (default: 100)
  -t, --timeout <number>       Request timeout in ms (default: 10000)
  -c, --concurrency <number>   Concurrent requests (default: 5)
  --user-agent <string>        User agent string (default: 'SEO-Metadata-Crawler/1.0 (Deno)')
  --sitemap-only               Only crawl URLs found in sitemap
  --follow-links               Follow links in addition to sitemap URLs (default: true)
  --force, -F                  Force a fresh crawl, ignoring cache
  -h, --help                   Show this help
  `);
  Deno.exit(0);
}

// Validate required parameters
if (!flags.url) {
  console.error(colors.red("Error: URL is required"));
  Deno.exit(1);
}

// Build options object
const options: CrawlOptions = {
  url: flags.url,
  sitemap: flags.sitemap || null,
  depth: flags.depth as number,
  output: flags.output || getCacheFilenameFromUrl(flags.url),
  format: flags.format as "json" | "csv" | "html",
  limit: flags.limit as number,
  timeout: flags.timeout as number,
  concurrency: flags.concurrency as number,
  userAgent: flags["user-agent"],
  sitemapOnly: flags["sitemap-only"],
  followLinks: flags["follow-links"],
  force: flags["force"],
};

// Ensure the URL has a protocol
let baseUrl = options.url;
if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
  baseUrl = "https://" + baseUrl;
}

// Parse the base URL to get the hostname
const parsedUrl = new URL(baseUrl);
const baseHostname = parsedUrl.hostname;
const baseProtocol = parsedUrl.protocol;

// Utility to get a safe filename from a URL
function getCacheFilenameFromUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
  } catch {
    return 'site-cache';
  }
}

// Utility to ensure output directory exists
function ensureOutputDir() {
  try {
    Deno.mkdirSync('output', { recursive: true });
  } catch (_) {}
}

// Utility to fetch and parse robots.txt for sitemap
async function getSitemapFromRobots(baseUrl: string): Promise<string | null> {
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

// Determine sitemap URL if not explicitly provided
let sitemapUrl = options.sitemap;
if (!sitemapUrl) {
  // Try robots.txt first
  const robotsSitemap = await getSitemapFromRobots(baseUrl);
  if (robotsSitemap) {
    sitemapUrl = robotsSitemap;
    console.log(colors.blue(`Found sitemap in robots.txt: ${sitemapUrl}`));
  } else {
    sitemapUrl = `${baseProtocol}//${baseHostname}/sitemap.xml`;
  }
}

// Initialize variables
const visited = new Set<string>();
const queue: QueueItem[] = [];
const results: PageMetadata[] = [];
let processed = 0;
let sitemapUrls: SitemapUrl[] = [];

// --- CACHE CHECK BEFORE CRAWL ---
ensureOutputDir();
const cacheFilename = `output/${getCacheFilenameFromUrl(baseUrl)}.json`;
if (!options.force) {
  try {
    const cacheText = Deno.readTextFileSync(cacheFilename);
    const cache = JSON.parse(cacheText);
    if (cache.crawlDate && Date.now() - new Date(cache.crawlDate).getTime() < 24 * 60 * 60 * 1000) {
      console.log(colors.bgYellow(colors.black("[CACHE] Using cached crawl data (less than 1 day old). Use --force to refresh.")));
      // Use cached results for report
      results.push(...(cache.pages || []));
      sitemapUrls = cache.pages ? cache.pages.filter((p: any) => p.inSitemap).map((p: any) => ({
        url: p.url,
        lastmod: p.lastmod || null,
        priority: p.priority || null,
        changefreq: p.changefreq || null,
      })) : [];
      generateReport();
      Deno.exit(0);
    }
  } catch (_) {
    // Ignore cache errors
  }
}

// Add the initial URL to the queue if we're not using sitemap-only mode
if (!options.sitemapOnly) {
  queue.push({ url: baseUrl, depth: 0 });
}

// Utility to normalize URLs
function normalizeUrl(url: string, base: string): string | null {
  try {
    const resolvedUrl = new URL(url, base);
    // Remove trailing slash and hash
    return resolvedUrl.href.replace(/#.*$/, "").replace(/\/$/, "");
  } catch (e) {
    return null;
  }
}

// Check if a URL belongs to the same domain
function isSameDomain(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname === baseHostname;
  } catch (e) {
    return false;
  }
}

// Fetch a URL and get the response text
async function fetchUrl(url: string): Promise<string> {
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

// Parse sitemap XML to extract URLs
async function parseSitemap(url: string): Promise<SitemapUrl[]> {
  console.log(`Parsing sitemap: ${url}`);
  
  try {
    const text = await fetchUrl(url);
    
    // Simple check to detect XML format
    if (!text.trim().startsWith("<?xml")) {
      console.log(colors.yellow(`The content at ${url} doesn't appear to be a valid XML sitemap.`));
      return [];
    }
    
    const parsed = parseXml(text);
    let urls: SitemapUrl[] = [];
    
    // Check if this is a sitemap index
    if (
      parsed.sitemapindex &&
      typeof parsed.sitemapindex === "object" &&
      "sitemap" in parsed.sitemapindex
    ) {
      const sitemapsRaw = parsed.sitemapindex.sitemap;
      const sitemaps = Array.isArray(sitemapsRaw) ? sitemapsRaw : [sitemapsRaw];
      console.log(colors.green(`Found sitemap index with ${sitemaps.length} sitemaps`));
      // Parse each child sitemap
      for (const sitemap of sitemaps) {
        if (sitemap && typeof sitemap === "object" && "loc" in sitemap) {
          const loc = typeof sitemap.loc === "string" ? sitemap.loc : sitemap.loc?._text;
          if (loc) {
            const childUrls = await parseSitemap(loc);
            urls = urls.concat(childUrls);
          }
        }
      }
    }
    // Regular sitemap
    else if (
      parsed.urlset &&
      typeof parsed.urlset === "object" &&
      "url" in parsed.urlset
    ) {
      const urlsRaw = parsed.urlset.url;
      const sitemap_urls = Array.isArray(urlsRaw) ? urlsRaw : [urlsRaw];
      console.log(colors.green(`Found sitemap with ${sitemap_urls.length} URLs`));
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
    const message = typeof error === "object" && error && "message" in error ? (error as any).message : String(error);
    console.error(colors.red(`Failed to parse sitemap: ${message}`));
    return [];
  }
}

// Extract metadata from a page
async function extractMetadata(url: string, depth: number, sitemapData?: { lastmod: string | null; priority: string | null; changefreq: string | null }): Promise<PageMetadata> {
  console.log(`Crawling ${url}`);
  
  try {
    const html = await fetchUrl(url);
    const doc = new DOMParser().parseFromString(html, "text/html");
    
    if (!doc) {
      throw new Error("Failed to parse HTML");
    }
    
    // Extract metadata
    const title = doc.querySelector("title")?.textContent?.trim() || "";
    const description = doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";
    const keywords = doc.querySelector('meta[name="keywords"]')?.getAttribute("content") || "";
    const h1Elements = doc.querySelectorAll("h1");
    const h1Count = h1Elements.length;
    const h1Text = h1Elements[0]?.textContent?.trim() || "";
    const canonicalUrl = doc.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
    
    // Open Graph metadata
    const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute("content") || "";
    const ogDescription = doc.querySelector('meta[property="og:description"]')?.getAttribute("content") || "";
    const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";
    
    // Twitter metadata
    const twitterCard = doc.querySelector('meta[name="twitter:card"]')?.getAttribute("content") || "";
    const twitterTitle = doc.querySelector('meta[name="twitter:title"]')?.getAttribute("content") || "";
    const twitterDescription = doc.querySelector('meta[name="twitter:description"]')?.getAttribute("content") || "";
    const twitterImage = doc.querySelector('meta[name="twitter:image"]')?.getAttribute("content") || "";
    
    // Robots metadata
    const robots = doc.querySelector('meta[name="robots"]')?.getAttribute("content") || "";
    
    // Calculate metadata quality scores
    const titleLength = title.length;
    const descriptionLength = description.length;
    const keywordsCount = keywords ? keywords.split(",").length : 0;
    
    // Get all links on the page
    const links: string[] = [];
    const linkElements = doc.querySelectorAll("a[href]");
    
    for (let i = 0; i < linkElements.length; i++) {
      const href = linkElements[i].getAttribute("href");
      if (href) {
        const normalizedUrl = normalizeUrl(href, url);
        if (normalizedUrl && isSameDomain(normalizedUrl) && !normalizedUrl.includes("mailto:")) {
          links.push(normalizedUrl);
        }
      }
    }
    
    // Assess metadata completeness
    const titleScore = titleLength > 10 && titleLength < 70 ? "good" : "needs improvement";
    const descriptionScore = descriptionLength > 50 && descriptionLength < 160 ? "good" : "needs improvement";
    const keywordsScore = keywordsCount > 0 && keywordsCount < 10 ? "good" : "needs improvement";
    const h1Score = h1Count === 1 ? "good" : "needs improvement";
    
    // Check if this URL was in the sitemap
    const inSitemap = sitemapUrls.some((item) => item.url === url);
    
    console.log(colors.green(`Processed ${url}`));
    
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
    };
  } catch (error) {
    const message = typeof error === "object" && error && "message" in error ? (error as any).message : String(error);
    console.error(colors.red(`Failed to crawl ${url}: ${message}`));
    
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

// Generate CSV from JSON
function jsonToCsv(data: any[]): string {
  if (data.length === 0) return "";
  
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(","),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return "";
        
        // Handle arrays or objects
        if (typeof value === "object") {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        
        // Escape quotes and handle strings with commas
        if (typeof value === "string" && (value.includes('"') || value.includes(','))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        
        return value;
      }).join(",")
    )
  ].join("\n");
  
  return csv;
}

// Helper to escape HTML
function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]||c));
}

// Generate HTML report
function generateHtmlReport(report: any, filename: string) {
  const { summary, crawlDate, baseUrl, options, pages } = report;
  const colorScore = (score: string) => score === "good" ? "style=\"color:green\"" : "style=\"color:red\"";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SEO Metadata Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2em; background: #f9f9f9; }
    h1 { color: #2c3e50; }
    .summary-table, .data-table { border-collapse: collapse; width: 100%; margin-bottom: 2em; }
    .summary-table th, .summary-table td, .data-table th, .data-table td { border: 1px solid #ccc; padding: 8px; }
    .summary-table th, .data-table th { background: #eaeaea; position: sticky; top: 0; z-index: 2; }
    .data-table tr:nth-child(even) { background: #f2f2f2; }
    .score-good { color: green; font-weight: bold; }
    .score-bad { color: red; font-weight: bold; }
    .error { color: #c0392b; }
    .in-sitemap { color: #2980b9; }
    .not-in-sitemap { color: #b2bec3; }
    .nowrap { white-space: nowrap; }
    .small { font-size: 0.95em; color: #888; }
    .table-container { overflow-x: auto; }
    @media (max-width: 900px) {
      .data-table, .summary-table { font-size: 0.95em; }
      body { margin: 0.5em; }
    }
  </style>
</head>
<body>
  <h1>SEO Metadata Report</h1>
  <div class="small">Crawled: ${escapeHtml(baseUrl)}<br>Date: ${escapeHtml(crawlDate)}</div>
  <h2>Summary</h2>
  <div class="table-container">
    <table class="summary-table">
      <tr><th>Metric</th><th>Count</th><th>Percentage</th></tr>
      <tr><td>Total Pages</td><td>${summary.totalPages}</td><td>100%</td></tr>
      <tr><td>Pages with Title</td><td>${summary.pagesWithTitle}</td><td>${summary.titleCompleteness}%</td></tr>
      <tr><td>Pages with Description</td><td>${summary.pagesWithDescription}</td><td>${summary.descriptionCompleteness}%</td></tr>
      <tr><td>Pages with Keywords</td><td>${summary.pagesWithKeywords}</td><td>${summary.keywordsCompleteness}%</td></tr>
      <tr><td>Pages with H1</td><td>${summary.pagesWithH1}</td><td>${summary.h1Completeness}%</td></tr>
      <tr><td>Pages with Canonical URL</td><td>${summary.pagesWithCanonical}</td><td>${summary.canonicalCompleteness}%</td></tr>
      <tr><td>Pages with Open Graph Tags</td><td>${summary.pagesWithOgTags}</td><td>${Math.round((summary.pagesWithOgTags / summary.totalPages) * 100)}%</td></tr>
      <tr><td>Pages with Twitter Tags</td><td>${summary.pagesWithTwitterTags}</td><td>${Math.round((summary.pagesWithTwitterTags / summary.totalPages) * 100)}%</td></tr>
      <tr><td>Pages in Sitemap</td><td>${summary.pagesInSitemap}</td><td>${Math.round((summary.pagesInSitemap / summary.totalPages) * 100)}%</td></tr>
      <tr><td>Pages not in Sitemap</td><td>${summary.pagesNotInSitemap}</td><td>${Math.round((summary.pagesNotInSitemap / summary.totalPages) * 100)}%</td></tr>
      <tr><td colspan="3"></td></tr>
      <tr><td>Pages with Title Issues</td><td>${summary.pagesWithTitleIssues}</td><td>${Math.round((summary.pagesWithTitleIssues / summary.totalPages) * 100)}%</td></tr>
      <tr><td>Pages with Description Issues</td><td>${summary.pagesWithDescriptionIssues}</td><td>${Math.round((summary.pagesWithDescriptionIssues / summary.totalPages) * 100)}%</td></tr>
      <tr><td>Pages with H1 Issues</td><td>${summary.pagesWithH1Issues}</td><td>${Math.round((summary.pagesWithH1Issues / summary.totalPages) * 100)}%</td></tr>
      <tr><td>Pages with Errors</td><td>${summary.pagesWithErrors}</td><td>${Math.round((summary.pagesWithErrors / summary.totalPages) * 100)}%</td></tr>
    </table>
  </div>
  <h2>Pages</h2>
  <div class="table-container">
    <table class="data-table">
      <tr>
        <th>#</th>
        <th>URL</th>
        <th>Title</th>
        <th>Title Score</th>
        <th>Description</th>
        <th>Description Score</th>
        <th>H1</th>
        <th>H1 Score</th>
        <th>Canonical</th>
        <th>In Sitemap</th>
        <th>Errors</th>
      </tr>
      ${pages.map((p: any, i: number) => `
        <tr>
          <td class="nowrap">${i + 1}</td>
          <td class="nowrap"><a href="${escapeHtml(p.url)}" target="_blank">${escapeHtml(p.url)}</a></td>
          <td>${escapeHtml(p.title)}</td>
          <td class="nowrap"><span class="score-${p.titleScore === "good" ? "good" : "bad"}">${escapeHtml(p.titleScore)}</span></td>
          <td>${escapeHtml(p.description)}</td>
          <td class="nowrap"><span class="score-${p.descriptionScore === "good" ? "good" : "bad"}">${escapeHtml(p.descriptionScore)}</span></td>
          <td>${escapeHtml(p.h1Text)}</td>
          <td class="nowrap"><span class="score-${p.h1Score === "good" ? "good" : "bad"}">${escapeHtml(p.h1Score)}</span></td>
          <td class="nowrap">${escapeHtml(p.canonicalUrl)}</td>
          <td class="nowrap"><span class="${p.inSitemap ? "in-sitemap" : "not-in-sitemap"}">${p.inSitemap ? "Yes" : "No"}</span></td>
          <td class="nowrap error">${p.error ? escapeHtml(p.error) : ""}</td>
        </tr>
      `).join("")}
    </table>
  </div>
</body>
</html>`;
  Deno.writeTextFileSync(filename, html);
}

// Generate the report
function generateReport() {
  // Create a summary
  const summary: ReportSummary = {
    totalPages: results.length,
    pagesWithTitle: results.filter(r => r.title).length,
    pagesWithDescription: results.filter(r => r.description).length,
    pagesWithKeywords: results.filter(r => r.keywords).length,
    pagesWithH1: results.filter(r => r.h1Count > 0).length,
    pagesWithCanonical: results.filter(r => r.canonicalUrl).length,
    pagesWithOgTags: results.filter(r => r.ogTitle || r.ogDescription || r.ogImage).length,
    pagesWithTwitterTags: results.filter(r => r.twitterCard || r.twitterTitle || r.twitterDescription || r.twitterImage).length,
    pagesWithTitleIssues: results.filter(r => r.titleScore === "needs improvement").length,
    pagesWithDescriptionIssues: results.filter(r => r.descriptionScore === "needs improvement").length,
    pagesWithH1Issues: results.filter(r => r.h1Score === "needs improvement").length,
    pagesWithErrors: results.filter(r => r.error).length,
    titleCompleteness: 0,
    descriptionCompleteness: 0,
    keywordsCompleteness: 0,
    h1Completeness: 0,
    canonicalCompleteness: 0,
    pagesInSitemap: results.filter(r => r.inSitemap).length,
    pagesNotInSitemap: results.filter(r => !r.inSitemap).length,
  };
  
  // Calculate percentages for the summary
  summary.titleCompleteness = Math.round((summary.pagesWithTitle / summary.totalPages) * 100);
  summary.descriptionCompleteness = Math.round((summary.pagesWithDescription / summary.totalPages) * 100);
  summary.keywordsCompleteness = Math.round((summary.pagesWithKeywords / summary.totalPages) * 100);
  summary.h1Completeness = Math.round((summary.pagesWithH1 / summary.totalPages) * 100);
  summary.canonicalCompleteness = Math.round((summary.pagesWithCanonical / summary.totalPages) * 100);
  
  // Add summary to the results
  const report = {
    summary,
    crawlDate: new Date().toISOString(),
    baseUrl,
    options,
    pages: results,
  };
  
  // Output format
  const filename = `${options.output}.${options.format}`;
  
  try {
    // Before crawling, check for cache
    ensureOutputDir();
    const cacheFilename = `output/${getCacheFilenameFromUrl(baseUrl)}.json`;
    
    // Always write JSON cache
    Deno.writeTextFileSync(cacheFilename, JSON.stringify(report, null, 2));
    if (options.format === "json") {
      Deno.writeTextFileSync(`output/${filename}`, JSON.stringify(report, null, 2));
    } else if (options.format === "csv") {
      // Flatten the objects for CSV
      const flattenedResults = results.map(page => ({
        url: page.url,
        title: page.title || "",
        titleLength: page.titleLength || 0,
        titleScore: page.titleScore || "",
        description: page.description || "",
        descriptionLength: page.descriptionLength || 0,
        descriptionScore: page.descriptionScore || "",
        keywords: page.keywords || "",
        keywordsCount: page.keywordsCount || 0,
        keywordsScore: page.keywordsScore || "",
        h1Count: page.h1Count || 0,
        h1Score: page.h1Score || "",
        h1Text: page.h1Text || "",
        canonicalUrl: page.canonicalUrl || "",
        ogTitle: page.ogTitle || "",
        ogDescription: page.ogDescription || "",
        ogImage: page.ogImage || "",
        twitterCard: page.twitterCard || "",
        twitterTitle: page.twitterTitle || "",
        twitterDescription: page.twitterDescription || "",
        twitterImage: page.twitterImage || "",
        robots: page.robots || "",
        depth: page.depth,
        inSitemap: page.inSitemap ? "yes" : "no",
        lastmod: page.lastmod || "",
        priority: page.priority || "",
        changefreq: page.changefreq || "",
        error: page.error || "",
      }));
      
      const csv = jsonToCsv(flattenedResults);
      Deno.writeTextFileSync(`output/${filename}`, csv);
    } else if (options.format === "html") {
      generateHtmlReport(report, `output/${filename}`);
    }
    
    console.log(colors.green(`Report saved to output/${filename}`));
    
    // Print a summary to the console
    console.log(colors.yellow("\nSEO Metadata Summary:"));
    
    const table = new Table()
      .header(["Metric", "Count", "Percentage"])
      .body([
        ["Total Pages", summary.totalPages.toString(), "100%"],
        ["Pages with Title", summary.pagesWithTitle.toString(), `${summary.titleCompleteness}%`],
        ["Pages with Description", summary.pagesWithDescription.toString(), `${summary.descriptionCompleteness}%`],
        ["Pages with Keywords", summary.pagesWithKeywords.toString(), `${summary.keywordsCompleteness}%`],
        ["Pages with H1", summary.pagesWithH1.toString(), `${summary.h1Completeness}%`],
        ["Pages with Canonical URL", summary.pagesWithCanonical.toString(), `${summary.canonicalCompleteness}%`],
        ["Pages with Open Graph Tags", summary.pagesWithOgTags.toString(), `${Math.round((summary.pagesWithOgTags / summary.totalPages) * 100)}%`],
        ["Pages with Twitter Tags", summary.pagesWithTwitterTags.toString(), `${Math.round((summary.pagesWithTwitterTags / summary.totalPages) * 100)}%`],
        ["Pages in Sitemap", summary.pagesInSitemap.toString(), `${Math.round((summary.pagesInSitemap / summary.totalPages) * 100)}%`],
        ["Pages not in Sitemap", summary.pagesNotInSitemap.toString(), `${Math.round((summary.pagesNotInSitemap / summary.totalPages) * 100)}%`],
        ["", "", ""],
        ["Pages with Title Issues", summary.pagesWithTitleIssues.toString(), `${Math.round((summary.pagesWithTitleIssues / summary.totalPages) * 100)}%`],
        ["Pages with Description Issues", summary.pagesWithDescriptionIssues.toString(), `${Math.round((summary.pagesWithDescriptionIssues / summary.totalPages) * 100)}%`],
        ["Pages with H1 Issues", summary.pagesWithH1Issues.toString(), `${Math.round((summary.pagesWithH1Issues / summary.totalPages) * 100)}%`],
        ["Pages with Errors", summary.pagesWithErrors.toString(), `${Math.round((summary.pagesWithErrors / summary.totalPages) * 100)}%`],
      ])
      .border(true);
    
    table.render();
    
    // Provide some quick recommendations
    console.log(colors.yellow("\nQuick Recommendations:"));
    
    if (summary.pagesWithTitleIssues > 0) {
      console.log(`- Fix titles on ${summary.pagesWithTitleIssues} pages (aim for 50-60 characters)`);
    }
    
    if (summary.pagesWithDescriptionIssues > 0) {
      console.log(`- Improve meta descriptions on ${summary.pagesWithDescriptionIssues} pages (aim for 120-155 characters)`);
    }
    
    if (summary.pagesWithH1Issues > 0) {
      console.log(`- Fix H1 issues on ${summary.pagesWithH1Issues} pages (each page should have exactly one H1 tag)`);
    }
    
    if (summary.pagesNotInSitemap > 0) {
      console.log(`- Add ${summary.pagesNotInSitemap} pages to your sitemap for better crawling`);
    }
    
    if (summary.pagesWithOgTags < summary.totalPages) {
      console.log(`- Add Open Graph tags to ${summary.totalPages - summary.pagesWithOgTags} pages for better social sharing`);
    }
    
  } catch (error) {
    const message = typeof error === "object" && error && "message" in error ? (error as any).message : String(error);
    console.error(colors.red(`Error saving report: ${message}`));
  }
}

// Main crawl function
async function crawl() {
  console.log(colors.blue(`Starting crawl of ${baseUrl} with max depth ${options.depth} and limit ${options.limit}`));
  
  // First, try to parse the sitemap
  console.log(colors.blue(`Attempting to parse sitemap at ${sitemapUrl}`));
  sitemapUrls = await parseSitemap(sitemapUrl as string);
  
  // Add sitemap URLs to the queue
  for (const item of sitemapUrls) {
    if (!visited.has(item.url) && processed < options.limit) {
      queue.push({
        url: item.url,
        depth: 0,
        sitemapData: {
          lastmod: item.lastmod,
          priority: item.priority,
          changefreq: item.changefreq,
        },
      });
    }
  }
  
  if (sitemapUrls.length === 0) {
    console.log(colors.yellow(`No URLs found in sitemap. ${options.sitemapOnly ? "Exiting as --sitemap-only was specified." : "Continuing with regular crawl."}`));
    if (options.sitemapOnly) {
      console.log(colors.yellow(`Try checking if the sitemap exists at ${sitemapUrl} or specify a different sitemap URL with --sitemap option.`));
      Deno.exit(0);
    }
  } else {
    console.log(colors.green(`Added ${sitemapUrls.length} URLs from sitemap to the crawl queue.`));
  }

  while (queue.length > 0 && processed < options.limit) {
    // Process up to concurrency items in parallel
    const batch = queue.splice(0, options.concurrency);
    const promises = batch.map(item => {
      if (visited.has(item.url)) {
        return Promise.resolve(null);
      }
      visited.add(item.url);
      processed++;
      return extractMetadata(item.url, item.depth, item.sitemapData);
    });
    const batchResults = await Promise.all(promises);
    // Process results and add new URLs to the queue
    for (const result of batchResults) {
      if (!result) continue;
      results.push(result);
      // If we're following links and haven't reached max depth, add links to the queue
      if (options.followLinks && result.depth < options.depth) {
        for (const link of result.links) {
          if (!visited.has(link)) {
            queue.push({ url: link, depth: result.depth + 1 });
          }
        }
      }
    }
  }
  console.log(colors.green(`Crawl completed. Processed ${processed} pages.`));
  generateReport();
}

// Start the crawl
crawl().catch(error => {
  console.error(colors.red(`Crawler error: ${error.message}`));
  Deno.exit(1);
});