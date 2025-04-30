import OpenAI from "openai";

export async function suggestTitleDescriptionKeywords({ html, url, currentTitle, currentDescription, currentKeywords, openai } : { html: string; url: string; currentTitle?: string; currentDescription?: string; currentKeywords?: string; openai: OpenAI; }): Promise<{ suggestedTitle?: string; suggestedDescription?: string; suggestedKeywords?: string }> {
  try {
    let prompt = `You are an expert SEO assistant. Given the following HTML content for the page at ${url}, suggest an improved, concise, and relevant <title> (max 60 characters), meta description (max 155 characters), and a set of 3-8 SEO keywords (comma-separated, no hashtags) for SEO. Dont suggest the following keywords: Port Authority, Redevelopment, New York, New Jersey. \n`;
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
      model: "gpt-4-1106-preview",
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
          suggestedKeywords: parsed.suggestedKeywords,
        };
      } catch (e) {
        const matchTitle = content.match(/"suggestedTitle"\s*:\s*"([^"]+)"/);
        const matchDesc = content.match(/"suggestedDescription"\s*:\s*"([^"]+)"/);
        const matchKeywords = content.match(/"suggestedKeywords"\s*:\s*"([^"]+)"/);
        return {
          suggestedTitle: matchTitle ? matchTitle[1] : undefined,
          suggestedDescription: matchDesc ? matchDesc[1] : undefined,
          suggestedKeywords: matchKeywords ? matchKeywords[1] : undefined,
        };
      }
    }
    return {};
  } catch (e) {
    return {};
  }
} 