import OpenAI from "openai";

export async function suggestTitleAndDescription({ html, url, currentTitle, currentDescription, openai } : { html: string; url: string; currentTitle?: string; currentDescription?: string; openai: OpenAI; }): Promise<{ suggestedTitle?: string; suggestedDescription?: string }> {
  try {
    let prompt = `You are an expert SEO assistant. Given the following HTML content for the page at ${url}, suggest an improved, concise, and relevant <title> (max 60 characters) and meta description (max 155 characters) for SEO.\n`;
    if (currentTitle) {
      prompt += `\nCurrent title: "${currentTitle}"`;
    }
    if (currentDescription) {
      prompt += `\nCurrent description: "${currentDescription}"`;
    }
    prompt += `\nHTML:\n${html.substring(0, 4000)}\n---\nRespond in JSON with keys 'suggestedTitle' and 'suggestedDescription'.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-1106-preview",
      messages: [
        { role: "system", content: "You are a helpful assistant for SEO metadata optimization." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (content) {
      try {
        const parsed = JSON.parse(content);
        return {
          suggestedTitle: parsed.suggestedTitle,
          suggestedDescription: parsed.suggestedDescription,
        };
      } catch (e) {
        const matchTitle = content.match(/"suggestedTitle"\s*:\s*"([^"]+)"/);
        const matchDesc = content.match(/"suggestedDescription"\s*:\s*"([^"]+)"/);
        return {
          suggestedTitle: matchTitle ? matchTitle[1] : undefined,
          suggestedDescription: matchDesc ? matchDesc[1] : undefined,
        };
      }
    }
    return {};
  } catch (e) {
    return {};
  }
} 