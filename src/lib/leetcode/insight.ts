export async function maybeGenerateInsight(input: {
  title: string;
  tags: string[];
  description?: string;
}): Promise<string | undefined> {
  const openai = process.env.OPENAI_API_KEY?.trim();
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  if (!openai && !anthropic) return undefined;

  const tags = input.tags.filter(Boolean).join(", ") || "unspecified";
  const excerpt = (input.description || "").slice(0, 800);
  const prompt = [
    `Write 1-2 short sentences with the general DSA insight for "${input.title}"`,
    `(patterns: ${tags}).`,
    "Do not dump a full solution or code.",
    excerpt ? `Problem excerpt:\n${excerpt}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    if (openai) {
      return await completeOpenAI(openai, prompt);
    }
    if (anthropic) {
      return await completeAnthropic(anthropic, prompt);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function completeOpenAI(apiKey: string, prompt: string): Promise<string | undefined> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 120,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) return undefined;
  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() || undefined;
}

async function completeAnthropic(
  apiKey: string,
  prompt: string,
): Promise<string | undefined> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) return undefined;
  const data = (await response.json()) as {
    content?: { type?: string; text?: string }[];
  };
  const text = data.content?.find((part) => part.type === "text")?.text;
  return text?.trim() || undefined;
}
