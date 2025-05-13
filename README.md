# SEO Metadata Crawler

A command-line utility written in **[Deno](https://deno.land)** that crawls a website, collects on-page SEO metadata, and produces a consolidated report (`json`, `csv`, or `html`).

---

## ✨ Features

* Parses a website's **HTML** and (optionally) **sitemap.xml**
* Extracts common SEO fields (title, meta-description, keywords, H1, canonical, Open Graph, Twitter tags…)
* Calculates simple quality scores (e.g. title length, description length, H1 count)
* **Suggests improved title, description, and keywords using OpenAI** (if needed)
* Generates a **summary table** + machine-readable report file
* Handles crawling depth, concurrency limits, timeout, user-agent and more via CLI flags
* Supports output formats: **JSON**, **CSV**, or **HTML**
* Can run in *sitemap-only* mode or follow in-page links
* **Resumes from cache**: will not re-crawl already processed pages
* Uses a `.env` file for your OpenAI API key
* **[NEW] Optional "push-back" add-on** – write the suggested metadata straight into your CMS (AEM today, WordPress/Drupal soon)
* **[OPTIONAL] Reference keyword support:** Place `.xlsx` files with keyword data in a `references/` folder to enhance keyword suggestions based on your own search data

---

## 🔧 Prerequisites

1. **Install Deno** (v1.41 or higher recommended):

```bash
# macOS / Linux
curl -fsSL https://deno.land/install.sh | sh

# Windows (PowerShell)
iwr https://deno.land/install.ps1 -useb | iex
```

> Verify installation with `deno --version`.

2. **Set up your OpenAI API key**

Create a `.env` file in your project root:

```
OPENAI_API_KEY=your-key-here
```

---

## 🚀 Usage

```bash
deno run --allow-net --allow-read --allow-write --allow-env main.ts --url https://example.com [options]
```

### Common Flags

| Flag | Alias | Default | Description |
| ---- | ----- | ------- | ----------- |
| `--url` | `-u` | – | **Required.** Base URL to crawl |
| `--page` | `-p` | – | Crawl a single page only (disables link following) |
| `--sitemap` | `-s` | `BASE_URL/sitemap.xml` | Explicit sitemap URL |
| `--depth` | `-d` | `3` | Maximum crawl depth |
| `--limit` | `-l` | `100` | Max pages to process |
| `--timeout` | `-t` | `10000` (ms) | Request timeout |
| `--concurrency` | `-c` | `5` | Parallel fetches |
| `--output` | `-o` | `seo-report` | Output file name (extension added automatically) |
| `--format` | `-f` | `json` | `json`, `csv`, or `html` |
| `--sitemap-only` | – | `false` | Only crawl URLs present in sitemap |
| `--follow-links` | – | `true` | Follow in-page links |
| `--user-agent` | – | `SEO-Metadata-Crawler/1.0 (Deno)` | Custom UA string |
| `--force` | `-F` | `false` | (Planned) Ignore cache and force fresh crawl |
| `--push-cms` | `-P` | `false` | Push suggested metadata back into CMS |
| `--cms-config` | `-C` | `cms.json` | Path to CMS JSON config (optional, defaults to cms.json) |
| `--help` | `-h` | – | Show help |

*Use either `--url` (site crawl) **or** `--page` (single-page crawl). If both are supplied, the single-page mode takes precedence.*

### Example

```bash
# Crawl example.com up to depth 2, output CSV
deno run --allow-net --allow-read --allow-write --allow-env main.ts \
  --url https://example.com \
  --depth 2 \
  --format csv
```

After completion you will find `seo-report.csv` (or `.json`/`.html`) in the output directory and a colourful summary printed to the terminal.

### Pushing Updates to AEM

```bash
deno run --allow-net --allow-read --allow-write --allow-env main.ts \
  --url https://www.example.com \
  --push-cms
```

# Or specify a custom config file:
# deno run ... --push-cms --cms-config path/to/your-config.json

`cms.json` example:
```json
{
  "aem": {
    "type": "aem",
    "authorUrl": "https://author.example.com",
    "publishUrl": "https://www.example.com",
    "username": "service-user",
    "password": "••••••",
    "sitePathPrefix": "/content/mysite",
    "replicateAfterUpdate": true,
    "propertyMap": {
      "title": "jcr:title",
      "description": "cq:description",
      "keywords": "cq:keywords"
    }
  }
}
```

Other CMS types (WordPress, Drupal) will get their own schemas in future releases.

The tool will update all fields defined in `propertyMap`. To control which fields are updated, simply adjust the keys in `propertyMap`.

### Optional: Using Reference Keyword Data

To further improve the relevance of suggested keywords, you can provide your own search data:

- Create a `references/` folder in the project root.
- Place one or more `.xlsx` files containing your keyword, clicks, and impressions data (e.g., exported from Google Search Console).
- The tool will automatically extract and prioritize top keywords from these files when generating suggestions.
- The `.xlsx` files should have columns for keywords, clicks, and impressions (column names are detected automatically).

This is optional, but highly recommended for tailoring suggestions to your site's actual search performance.

---

## 🏗 Building a Native Executable

Deno can bundle this script (including its dependencies) into a single binary.
Use the provided **Deno task** or run the command directly:

```bash
# via deno task (requires deno.json – see below)
deno task build

# or directly
deno compile \
  --allow-net --allow-read --allow-write --allow-env \
  --output seo-crawler \
  main.ts
```

This creates a platform-specific executable named `seo-crawler` (or `.exe` on Windows) that you can distribute without requiring Deno.

---

## 📂 Project Structure

```
.
├── main.ts         # Main CLI entry point
├── types.ts        # Type definitions
├── crawl.ts        # Crawl logic
├── metadata.ts     # Metadata extraction
├── openai.ts       # OpenAI integration
├── report.ts       # Report generation
├── robots.ts       # robots.txt logic
├── sitemap.ts      # Sitemap parsing
├── utils/          # Utility modules (url, file, csv, html)
├── output/         # Output and cache files
├── .env            # Your OpenAI API key
└── README.md       # This file
```

---

## 📝 Changelog

### 2024-06-10
- **Enhanced SEO keyword suggestion logic:**
  - The tool now prioritizes top keywords based on impressions and clicks when suggesting improved metadata.
  - The OpenAI prompt for suggestions now uses extracted visible text content from the HTML, improving the relevance of generated titles, descriptions, and keywords.
