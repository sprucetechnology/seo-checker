import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { parse as parseFlags } from "https://deno.land/std/flags/mod.ts";
import { pushToCms } from "./cms/index.ts";
import * as colors from "https://deno.land/std/fmt/colors.ts";
import OpenAI from "openai";
import { crawl } from "./crawl.ts";
import { getSitemapFromRobots } from "./robots.ts";
import { getCacheFilenameFromUrl } from "./utils/url.ts";
import { CrawlOptions } from "./types.ts";
import { resolve } from "https://deno.land/std/path/mod.ts";

const openai = new OpenAI();

const flags = parseFlags(Deno.args, {
  string: ["url", "page", "sitemap", "output", "format", "user-agent", "cms-config"],
  boolean: ["sitemap-only", "follow-links", "help", "force", "push-cms"],
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
    "push-cms": false,
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
    P: "push-cms",
    C: "cms-config",
    p: "page",
  },
});

if (flags.help) {
  console.log(`\nSEO Metadata Crawler\n\nUSAGE:\n  deno run --allow-net --allow-write --allow-read main.ts --url <url> [options]\n`);
  Deno.exit(0);
}
if (!flags.url && !flags.page) {
  console.error(colors.red("Error: URL is required"));
  Deno.exit(1);
}
// If --page supplied, crawl just that page
if (flags.page) {
  flags.url = flags.page;
  flags["follow-links"] = false;
}
const singlePageMode = Boolean(flags.page);
const targetUrl = flags.url as string; // guaranteed defined after validation

const options: CrawlOptions = {
  url: targetUrl,
  sitemap: flags.sitemap || null,
  depth: flags.depth as number,
  output: flags.output || getCacheFilenameFromUrl(targetUrl),
  format: flags.format as "json" | "csv" | "html",
  limit: flags.limit as number,
  timeout: flags.timeout as number,
  concurrency: flags.concurrency as number,
  userAgent: flags["user-agent"],
  sitemapOnly: flags["sitemap-only"],
  followLinks: flags["follow-links"],
  force: flags["force"],
  singlePage: singlePageMode,
};

if (singlePageMode) {
  // Ensure no sitemap parsing and minimal crawl footprint
  options.sitemap = "";
  options.depth = 0;
  options.limit = 1;
}

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

const pages = await crawl({ baseUrl, baseHostname, options, openai });

if (flags["push-cms"]) {
  // Default to cms.json if --cms-config is not specified
  const configPath = resolve(String(flags["cms-config"] || "cms.json"));
  try {
    const configText = await Deno.readTextFile(configPath);
    const config = JSON.parse(configText);
    // Determine which CMS to use. For now, default to 'aem'.
    const cmsType = config.aem ? 'aem' : Object.keys(config)[0];
    const cmsOptions = config[cmsType];
    await pushToCms(cmsOptions, pages);
  } catch (err) {
    console.error(colors.red(`Failed to push to CMS: ${err instanceof Error ? err.message : String(err)}`));
    if (err instanceof Deno.errors.NotFound) {
      console.error(colors.red("cms.json not found. Please provide a config file with --cms-config or create cms.json in your project root."));
    }
  }
} 