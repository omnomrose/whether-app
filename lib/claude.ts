// Claude API helpers — clothing tagging + outfit recommendations

const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY!;
const CLAUDE_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

// Auto-tag a clothing item from its image (base64)
export async function tagClothingItem(base64Image: string): Promise<string[]> {
  const res = await fetch(CLAUDE_URL, {
    method: "POST",
    headers: {
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64Image,
              },
            },
            {
              type: "text",
              text: 'Analyze this clothing item. Return a JSON array of tags only — include: fabric type, color, clothing type, style (e.g. casual/formal/sporty), and weather suitability (e.g. warm/cold/layering). Example: ["cotton", "white", "t-shirt", "casual", "warm-weather"]. Return only the JSON array, no explanation.',
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) throw new Error("Claude tagging failed");
  const data = await res.json();
  const text = data.content[0].text;
  return JSON.parse(text);
}

// Generate outfit suggestions based on weather + closet + plans
export async function getOutfitSuggestions(params: {
  weather: { temp: number; feelsLike: number; description: string };
  closetItems: { category: string; tags: string[]; imageUrl: string }[];
  dayPlans: string;
}): Promise<{ itemIndices: number[]; reason: string }[]> {
  const res = await fetch(CLAUDE_URL, {
    method: "POST",
    headers: {
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a personal stylist. Based on the weather and the user's plans, suggest 2-3 outfit combinations from their closet.

Weather: ${params.weather.temp}°C, feels like ${params.weather.feelsLike}°C, ${params.weather.description}
Day plans: ${params.dayPlans}
Closet items (index, category, tags): ${JSON.stringify(
            params.closetItems.map((item, i) => ({
              index: i,
              category: item.category,
              tags: item.tags,
            }))
          )}

Return a JSON array of outfit suggestions. Each suggestion: { "itemIndices": [array of closet item indices], "reason": "short explanation" }. Return only the JSON array.`,
        },
      ],
    }),
  });

  if (!res.ok) throw new Error("Claude outfit suggestion failed");
  const data = await res.json();
  return JSON.parse(data.content[0].text);
}
