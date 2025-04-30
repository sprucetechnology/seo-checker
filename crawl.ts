import { CrawlOptions, PageMetadata, SitemapUrl } from "./types.ts";
import { parseSitemap } from "./sitemap.ts";
import { extractMetadata } from "./metadata.ts";
import { ensureOutputDir } from "./utils/file.ts";
import { getCacheFilenameFromUrl } from "./utils/url.ts";
import { generateReport, generateHtmlReport } from "./report.ts";
import { jsonToCsv } from "./utils/csv.ts";
import * as colors from "https://deno.land/std/fmt/colors.ts";

export async function crawl({ baseUrl, baseHostname, options, openai }: {
  baseUrl: string;
  baseHostname: string;
  options: CrawlOptions;
  openai: any;
}) {
  let sitemapUrls: SitemapUrl[] = [];
  const visited = new Set<string>();
  const queue: { url: string; depth: number; sitemapData?: { lastmod: string | null; priority: string | null; changefreq: string | null } }[] = [];
  let results: PageMetadata[] = [];
  let processed = 0;
  ensureOutputDir();
  const cacheFilename = `output/${getCacheFilenameFromUrl(baseUrl)}.json`;
  const outFilename = `output/${options.output}.${options.format}`;

  // Load cache if it exists
  try {
    const cacheText = Deno.readTextFileSync(cacheFilename);
    const cache = JSON.parse(cacheText);
    if (cache.pages && Array.isArray(cache.pages)) {
      results = cache.pages;
      for (const page of results) {
        visited.add(page.url);
      }
      processed = results.length;
      console.log(colors.yellow(`Loaded ${results.length} pages from cache.`));
    }
  } catch (_) {
    // No cache or error reading cache
  }

  // Try to parse the sitemap
  console.log(colors.blue(`Attempting to parse sitemap at ${options.sitemap || ''}`));
  sitemapUrls = await parseSitemap(options.sitemap || '', { userAgent: options.userAgent, timeout: options.timeout });
  const totalToProcess = Math.min(sitemapUrls.length || queue.length, options.limit);
  console.log(colors.green(`Found ${sitemapUrls.length} URLs in sitemap.`));

  // Add sitemap URLs to the queue if not already in results
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
      console.log(colors.blue(`Queued from sitemap: ${item.url}`));
    }
  }

  if (!options.sitemapOnly) {
    if (!visited.has(baseUrl)) {
      queue.push({ url: baseUrl, depth: 0 });
      console.log(colors.blue(`Queued base URL: ${baseUrl}`));
    }
  }

  while (queue.length > 0 && processed < options.limit) {
    const batch = queue.splice(0, options.concurrency);
    console.log(colors.yellow(`Processing batch of ${batch.length} URLs... (Processed ${processed}/${sitemapUrls.length})`));
    const promises = batch.map(async item => {
      if (visited.has(item.url)) return null;
      visited.add(item.url);
      processed++;
      try {
        const meta = await extractMetadata({
          url: item.url,
          depth: item.depth,
          sitemapData: item.sitemapData,
          sitemapUrls,
          openai,
          options,
          baseHostname,
        });
        console.log(colors.green(`Crawled: ${item.url}`));
        return meta;
      } catch (err) {
        console.error(colors.red(`Error crawling ${item.url}: ${err}`));
        return null;
      }
    });
    const batchResults = await Promise.all(promises);
    for (const result of batchResults) {
      if (!result) continue;
      results.push(result);
      // Save progress after each page
      Deno.writeTextFileSync(cacheFilename, JSON.stringify({
        crawlDate: new Date().toISOString(),
        baseUrl,
        options,
        pages: results,
      }, null, 2));
    }
    // Also update the main output file in the selected format after each batch
    if (options.format === "json") {
      Deno.writeTextFileSync(outFilename, JSON.stringify({
        crawlDate: new Date().toISOString(),
        baseUrl,
        options,
        pages: results,
      }, null, 2));
    } else if (options.format === "csv") {
      const flattenedResults = results.map(page => ({
        url: page.url,
        title: page.title || "",
        suggestedTitle: page.suggestedTitle || "",
        titleLength: page.titleLength || 0,
        titleScore: page.titleScore || "",
        description: page.description || "",
        suggestedDescription: page.suggestedDescription || "",
        descriptionLength: page.descriptionLength || 0,
        descriptionScore: page.descriptionScore || "",
        keywords: page.keywords || "",
        suggestedKeywords: page.suggestedKeywords || "",
        keywordsCount: page.keywordsCount || 0,
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
      Deno.writeTextFileSync(outFilename, csv);
    } else if (options.format === "html") {
      generateHtmlReport({
        summary: {}, // Will be filled in by generateReport at the end
        crawlDate: new Date().toISOString(),
        baseUrl,
        options,
        pages: results,
      }, outFilename);
    }
    console.log(colors.yellow(`Batch complete. Total processed: ${results.length}/${sitemapUrls.length}`));
    // If we're following links and haven't reached max depth, add links to the queue
    for (const result of batchResults) {
      if (!result) continue;
      if (options.followLinks && result.depth < options.depth) {
        for (const link of result.links) {
          if (!visited.has(link)) {
            queue.push({ url: link, depth: result.depth + 1 });
            console.log(colors.blue(`Queued link: ${link}`));
          }
        }
      }
    }
  }
  console.log(colors.green(`Crawl completed. Processed ${processed}/${sitemapUrls.length} pages.`));
  generateReport({ results, options, baseUrl });
} 