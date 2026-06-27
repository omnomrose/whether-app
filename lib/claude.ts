// Claude API helpers — clothing tagging + outfit recommendations

const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY!;
const CLAUDE_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

// ─── Structured clothing tags (matches in-app filter UI) ──────────────────────
export type ClothingTags = {
  type:   string;    // e.g. "T-SHIRT"
  styles: string[];  // e.g. ["CASUAL", "COOL"]
  colour: string;    // e.g. "WHITE"
};

const TYPE_OPTIONS: Record<string, string[]> = {
  top:    ['T-SHIRT', 'TANK', 'BUTTON-DOWN', 'CARDIGAN', 'CORSET', 'PEPLUM', 'VEST', 'BLOUSE'],
  bottom: ['JEANS', 'TROUSERS', 'SHORTS', 'SKIRT', 'LEGGINGS'],
  shoes:  ['SNEAKERS', 'BOOTS', 'HEELS', 'SANDALS', 'LOAFERS', 'FLATS'],
};

const STYLE_OPTIONS = ['CUTE', 'NOSTALGIC', 'COOL', 'CLASSIC', 'BOLD', 'CASUAL', 'COMFY', 'ELEGANT'];
const COLOUR_OPTIONS = ['RED', 'ORANGE', 'YELLOW', 'GREEN', 'LIGHT BLUE', 'PURPLE', 'PINK', 'BLACK', 'GRAY', 'WHITE'];

// Convert any image URI (data: or file://) to { base64, mediaType } for Claude
async function uriToClaudeImage(
  uri: string,
): Promise<{ base64: string; mediaType: 'image/jpeg' | 'image/png' }> {
  if (uri.startsWith('data:')) {
    const commaIdx    = uri.indexOf(',');
    const semicolonIdx = uri.indexOf(';');
    const mediaType   = uri.slice(5, semicolonIdx) as 'image/jpeg' | 'image/png';
    return { base64: uri.slice(commaIdx + 1), mediaType };
  }

  // file:// URI — fetch blob → FileReader → base64
  const res  = await fetch(uri);
  const blob = await res.blob();

  const FR = (globalThis as any).FileReader;
  if (typeof FR !== 'undefined') {
    const dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FR();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const commaIdx    = dataUri.indexOf(',');
    const semicolonIdx = dataUri.indexOf(';');
    const mediaType   = dataUri.slice(5, semicolonIdx) as 'image/jpeg' | 'image/png';
    return { base64: dataUri.slice(commaIdx + 1), mediaType };
  }

  // Fallback: arrayBuffer → btoa
  const buffer = await blob.arrayBuffer();
  const bytes  = new Uint8Array(buffer);
  let binary   = '';
  const CHUNK  = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK)
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return { base64: btoa(binary), mediaType: 'image/jpeg' };
}

/**
 * Auto-tag a clothing item using structured fields (type, styles, colour).
 * Pass bgRemovedUri if available (better accuracy), else rawUri.
 */
export async function tagClothingItemStructured(
  imageUri: string,
  category: 'top' | 'bottom' | 'shoes',
): Promise<ClothingTags> {
  const { base64, mediaType } = await uriToClaudeImage(imageUri);
  const types = TYPE_OPTIONS[category] ?? TYPE_OPTIONS.top;

  const res = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'x-api-key':          CLAUDE_API_KEY,
      'anthropic-version':  '2023-06-01',
      'content-type':       'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type:   'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Analyze this ${category} clothing item and return a JSON object with exactly these fields:
- "type": pick ONE from [${types.join(', ')}]
- "styles": pick 1–3 from [${STYLE_OPTIONS.join(', ')}] that best match the vibe
- "colour": pick ONE from [${COLOUR_OPTIONS.join(', ')}] for the dominant colour

Return ONLY the JSON object, no commentary. Example: {"type":"T-SHIRT","styles":["CASUAL","COOL"],"colour":"WHITE"}`,
          },
        ],
      }],
    }),
  });

  if (!res.ok) throw new Error(`Claude tagging failed: ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.content[0].text) as ClothingTags;
}

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
