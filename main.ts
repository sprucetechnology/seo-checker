import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { parse as parseFlags } from "https://deno.land/std/flags/mod.ts";
import * as colors from "https://deno.land/std/fmt/colors.ts";
import OpenAI from "openai";
import { crawl } from "./crawl.ts";
import { getSitemapFromRobots } from "./robots.ts";
import { getCacheFilenameFromUrl } from "./utils/url.ts";
import { CrawlOptions } from "./types.ts";

const openai = new OpenAI();

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

if (flags.help) {
  console.log(`\nSEO Metadata Crawler\n\nUSAGE:\n  deno run --allow-net --allow-write --allow-read main.ts --url <url> [options]\n`);
  Deno.exit(0);
}
if (!flags.url) {
  console.error(colors.red("Error: URL is required"));
  Deno.exit(1);
}
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
let baseUrl = options.url;
if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
  baseUrl = "https://" + baseUrl;
}
const parsedUrl = new URL(baseUrl);
const baseHostname = parsedUrl.hostname;
const baseProtocol = parsedUrl.protocol;
let sitemapUrl = options.sitemap;
if (!sitemapUrl) {
  const robotsSitemap = await getSitemapFromRobots(baseUrl, options);
  if (robotsSitemap) {
    sitemapUrl = robotsSitemap;
    console.log(colors.blue(`Found sitemap in robots.txt: ${sitemapUrl}`));
  } else {
    sitemapUrl = `${baseProtocol}//${baseHostname}/sitemap.xml`;
  }
}
options.sitemap = sitemapUrl;
await crawl({ baseUrl, baseHostname, options, openai }); 