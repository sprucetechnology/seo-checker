import { ReportSummary, PageMetadata, CrawlOptions } from "./types.ts";
import { jsonToCsv } from "./utils/csv.ts";
import { escapeHtml } from "./utils/html.ts";

// HTML report generator
export function generateHtmlReport(report: any, filename: string) {
  const { summary, crawlDate, baseUrl, options, pages } = report;
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
        <th>Suggested Title</th>
        <th>Title Score</th>
        <th>Description</th>
        <th>Suggested Description</th>
        <th>Description Score</th>
        <th>H1</th>
        <th>Canonical</th>
        <th>In Sitemap</th>
        <th>Errors</th>
      </tr>
      ${pages.map((p: any, i: number) => `
        <tr>
          <td class="nowrap">${i + 1}</td>
          <td class="nowrap"><a href="${escapeHtml(p.url)}" target="_blank">${escapeHtml(p.url)}</a></td>
          <td>${escapeHtml(p.title)}</td>
          <td>${escapeHtml(p.suggestedTitle || "")}</td>
          <td class="nowrap"><span class="score-${p.titleScore === "good" ? "good" : "bad"}">${escapeHtml(p.titleScore)}</span></td>
          <td>${escapeHtml(p.description)}</td>
          <td>${escapeHtml(p.suggestedDescription || "")}</td>
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

// Main report generator
export function generateReport({ results, options, baseUrl }: { results: PageMetadata[]; options: CrawlOptions; baseUrl: string }) {
  // ... implementation will be completed after crawl.ts is created ...
} 