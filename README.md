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
| `--help` | `-h` | – | Show help |

### Example

```bash
# Crawl example.com up to depth 2, output CSV
deno run --allow-net --allow-read --allow-write --allow-env main.ts \
  --url https://example.com \
  --depth 2 \
  --format csv
```

After completion you will find `seo-report.csv` (or `.json`/`.html`) in the output directory and a colourful summary printed to the terminal.

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

## 📝 Suggestions & Potential Improvements

1. **Version Pinning / Import Map** – Pin external module versions to avoid breaking changes and improve cache hits. Maintain an `import_map.json`.
2. **Type Safety** – Add explicit return types & leverage utility types to strengthen compile-time checks.
3. **Robots.txt Respect** – Optionally fetch and respect `robots.txt` disallow rules.
4. **Retry Logic & Exponential Backoff** – Gracefully retry failed requests instead of aborting immediately.
5. **Cache Layer** – Cache previously fetched pages (e.g. in a `.cache` directory) to speed up repeated runs.
6. **Advanced Scoring Algorithm** – Replace simple *good/needs improvement* heuristics with weighted scores (e.g. considering SERP best practices).
7. **Parallel CSV/JSON Output** – Stream results to disk incrementally to reduce memory usage on very large sites.
8. **Pluggable Output Renderers** – Support HTML or Markdown reports with charts/visualisations.
9. **Unit Tests** – Add unit/integration tests using [deno test](https://deno.land/manual@latest/testing).
10. **CI Workflow** – Provide GitHub Actions workflow that runs lint/format/test and builds binaries for major OSes.

---

## 🙏 Contributing

Issues and pull requests are welcome! Feel free to open an issue for bugs, feature requests or suggestions.

---

## 📄 License

MIT © 2024 