import OpenAI from "openai";
import { ReferenceKeyword } from "./utils/xlsx.ts";

export async function suggestTitleDescriptionKeywords({ html, url, currentTitle, currentDescription, currentKeywords, openai, referenceKeywords } : { html: string; url: string; currentTitle?: string; currentDescription?: string; currentKeywords?: string; openai: OpenAI; referenceKeywords?: ReferenceKeyword[] }): Promise<{ suggestedTitle?: string; suggestedDescription?: string; suggestedKeywords?: string }> {
  try {
    let prompt = `You are an expert SEO assistant.\nGiven the following HTML content for the page at ${url}, suggest an improved, concise, and relevant <title> (max 60 characters), meta description (max 155 characters), and a set of 3-4 SEO keywords (comma-separated, no hashtags) for SEO.\nDont suggest the following keywords: Port Authority, Redevelopment, New York, New Jersey. \n`;

    if (referenceKeywords && referenceKeywords.length > 0) {
      const topKeywords = referenceKeywords.slice(0, 10)
        .map(k => `${k.keyword}${k.clicks ? ` (clicks: ${k.clicks}` : ""}${k.impressions ? `, impressions: ${k.impressions}` : ""}${k.clicks || k.impressions ? ")" : ""}`)
        .join(", ");
      prompt += `\nIts okay to suggest new keywords but prioritize ones from this list when appropriate: ${topKeywords}`;
    }

    if (currentTitle) {
      prompt += `\nCurrent title: "${currentTitle}"`;
    }
    if (currentDescription) {
      prompt += `\nCurrent description: "${currentDescription}"`;
    }
    if (currentKeywords) {
      prompt += `\nCurrent keywords: "${currentKeywords}"`;
    }
    prompt += `\nHTML:\n${html.substring(0, 4000)}\n---\nRespond in JSON with keys 'suggestedTitle', 'suggestedDescription', and 'suggestedKeywords'.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-2025-04-14",
      messages: [
        { role: "system", content: "You are a helpful assistant for SEO metadata optimization." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 350,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (content) {
      try {
        const parsed = JSON.parse(content);
        return {
          suggestedTitle: parsed.suggestedTitle,
          suggestedDescription: parsed.suggestedDescription,
          suggestedKeywords: parsed.suggestedKeywords ? parsed.suggestedKeywords.toLowerCase() : undefined,
        };
      } catch (e) {
        const matchTitle = content.match(/"suggestedTitle"\s*:\s*"([^"]+)"/);
        const matchDesc = content.match(/"suggestedDescription"\s*:\s*"([^"]+)"/);
        const matchKeywords = content.match(/"suggestedKeywords"\s*:\s*"([^"]+)"/);
        return {
          suggestedTitle: matchTitle ? matchTitle[1] : undefined,
          suggestedDescription: matchDesc ? matchDesc[1] : undefined,
          suggestedKeywords: matchKeywords ? matchKeywords[1].toLowerCase() : undefined,
        };
      }
    }
    return {};
  } catch (e) {
    return {};
  }
} 