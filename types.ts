export interface CrawlOptions {
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

export interface QueueItem {
  url: string;
  depth: number;
  sitemapData?: {
    lastmod: string | null;
    priority: string | null;
    changefreq: string | null;
  };
}

export interface PageMetadata {
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
  suggestedTitle?: string;
  suggestedDescription?: string;
  html?: string;
}

export interface SitemapUrl {
  url: string;
  lastmod: string | null;
  priority: string | null;
  changefreq: string | null;
}

export interface ReportSummary {
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