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
  singlePage?: boolean;
  pushCms?: boolean;
  cms?: CmsOptions;
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
  suggestedKeywords?: string;
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

export interface CmsOptions {
  /** CMS type identifier */
  type: "aem" | "wordpress" | "drupal";

  /** Generic base/admin URL for the CMS REST endpoint (used for WordPress/Drupal) */
  baseUrl?: string;

  /** AEM-specific: author instance URL */
  authorUrl?: string;
  /** AEM-specific: publish instance URL (needed only for URL ↔ JCR mapping) */
  publishUrl?: string;

  /** Credentials (username/password) or token (for WordPress) */
  username?: string;
  password?: string;
  token?: string;

  /** AEM only: Path prefix like "/content/mysite" used to convert public URL → JCR path */
  sitePathPrefix?: string;

  /** AEM only: whether to replicate page after updating */
  replicateAfterUpdate?: boolean;

  /** Custom mapping from logical fields (title, description, keywords) to CMS-specific property names */
  propertyMap?: Record<string, string>;

  /** Which logical fields to push back. Omit or empty = all. */
  updateFields?: Array<"title" | "description" | "keywords">;

  /** Namespace to use for tag creation (AEM only, e.g. 'redevelopment') */
  tagNamespace?: string;
} 