// XLSX utility functions for extracting keywords and metrics from reference files
import * as XLSX from "xlsx";
import OpenAI from "openai";

const REFERENCE_DIR = "references";
const CACHE_FILE = `${REFERENCE_DIR}/keywords-cache.json`;
const KEYWORD_COLUMN_NAMES = ["keyword", "keywords", "search term", "term", "query"];
const CLICK_COLUMN_NAMES = ["clicks", "click"];
const IMPRESSION_COLUMN_NAMES = ["impressions", "impression"];

export interface ReferenceKeyword {
  keyword: string;
  clicks?: number;
  impressions?: number;
  [key: string]: any;
}

function detectColumn(header: string, candidates: string[]): boolean {
  return candidates.some((c) => header.toLowerCase().includes(c));
}

// Use OpenAI to identify keyword and metric columns from a sample of sheet data
async function aiIdentifyColumns(sheetSample: Record<string, any>[], openai: OpenAI): Promise<{ keywordCol?: string; clickCol?: string; impressionCol?: string }> {
  const prompt = `You are an expert at analyzing Excel data. Given the following sample rows from a spreadsheet (as JSON objects), identify:\n- The column that contains search keywords\n- The column for clicks (if any)\n- The column for impressions (if any)\nRespond in JSON with keys: keywordCol, clickCol, impressionCol. If not found, use null.\n\nSample data:\n${JSON.stringify(sheetSample, null, 2)}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4-1106-preview",
    messages: [
      { role: "system", content: "You are a helpful assistant for spreadsheet data extraction." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    max_tokens: 200,
    temperature: 0.2,
  });
  const content = completion.choices[0]?.message?.content;
  if (content) {
    try {
      const parsed = JSON.parse(content);
      return {
        keywordCol: parsed.keywordCol || undefined,
        clickCol: parsed.clickCol || undefined,
        impressionCol: parsed.impressionCol || undefined,
      };
    } catch (_) {
      // fallback
    }
  }
  return {};
}

async function getCacheMtime(): Promise<number | null> {
  try {
    const stat = await Deno.stat(CACHE_FILE);
    return stat.mtime ? stat.mtime.getTime() : null;
  } catch {
    return null;
  }
}

async function getLatestXlsxMtime(): Promise<number> {
  let latest = 0;
  for await (const entry of Deno.readDir(REFERENCE_DIR)) {
    if (!entry.isFile || !entry.name.endsWith(".xlsx")) continue;
    const filePath = `${REFERENCE_DIR}/${entry.name}`;
    const stat = await Deno.stat(filePath);
    const mtime = stat.mtime ? stat.mtime.getTime() : 0;
    if (mtime > latest) latest = mtime;
  }
  return latest;
}

export async function extractReferenceKeywords(openai?: OpenAI): Promise<ReferenceKeyword[]> {
  // Check cache
  const cacheMtime = await getCacheMtime();
  const latestXlsxMtime = await getLatestXlsxMtime();
  if (cacheMtime && cacheMtime > latestXlsxMtime) {
    try {
      const cacheText = await Deno.readTextFile(CACHE_FILE);
      return JSON.parse(cacheText);
    } catch {}
  }
  // Otherwise, process and cache
  const keywords: ReferenceKeyword[] = [];
  for await (const entry of Deno.readDir(REFERENCE_DIR)) {
    if (!entry.isFile || !entry.name.endsWith(".xlsx")) continue;
    const filePath = `${REFERENCE_DIR}/${entry.name}`;
    const data = await Deno.readFile(filePath);
    const workbook = XLSX.read(data, { type: "buffer" });
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (rows.length === 0) continue;
      let keywordCol: string | undefined;
      let clickCol: string | undefined;
      let impressionCol: string | undefined;
      // Use AI if available and enough rows
      if (openai && rows.length > 0) {
        const sample = rows.slice(0, 20);
        const aiCols = await aiIdentifyColumns(sample, openai);
        keywordCol = aiCols.keywordCol;
        clickCol = aiCols.clickCol;
        impressionCol = aiCols.impressionCol;
      }
      // Fallback to heuristics if AI fails
      if (!keywordCol) {
        const headers = Object.keys(rows[0]);
        keywordCol = headers.find((h) => detectColumn(h, KEYWORD_COLUMN_NAMES));
        clickCol = headers.find((h) => detectColumn(h, CLICK_COLUMN_NAMES));
        impressionCol = headers.find((h) => detectColumn(h, IMPRESSION_COLUMN_NAMES));
      }
      if (!keywordCol) continue;
      for (const row of rows) {
        const keyword = String(row[keywordCol]).trim();
        if (!keyword) continue;
        const clicks = clickCol ? Number(row[clickCol]) || 0 : undefined;
        const impressions = impressionCol ? Number(row[impressionCol]) || 0 : undefined;
        keywords.push({ keyword, clicks, impressions });
      }
    }
  }
  // Save to cache
  await Deno.writeTextFile(CACHE_FILE, JSON.stringify(keywords, null, 2));
  return keywords;
}

// Utility to get top N keywords by clicks or impressions
export async function getTopReferenceKeywords(limit = 20, openai?: OpenAI): Promise<ReferenceKeyword[]> {
  const all = await extractReferenceKeywords(openai);
  // Sort by clicks, then impressions
  all.sort((a, b) => (b.clicks || 0) - (a.clicks || 0) || (b.impressions || 0) - (a.impressions || 0));
  // Deduplicate by keyword
  const seen = new Set<string>();
  const top: ReferenceKeyword[] = [];
  for (const k of all) {
    if (!seen.has(k.keyword.toLowerCase())) {
      seen.add(k.keyword.toLowerCase());
      top.push(k);
    }
    if (top.length >= limit) break;
  }
  return top;
} 