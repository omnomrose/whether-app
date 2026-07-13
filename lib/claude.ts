// Claude API helpers — clothing tagging + outfit recommendations

const CLAUDE_API_KEY = process.env.EXPO_PUBLIC_CLAUDE_API_KEY!;
const CLAUDE_URL = "https://api.anthropic.com/v1/messages";
// NOTE: "claude-sonnet-4-6" (previous value) is not a valid model ID — every
// tagging call 404'd and errors were swallowed, so items never got tags.
const MODEL = "claude-sonnet-5";

// ─── Structured clothing tags (matches in-app filter UI) ──────────────────────
export type ClothingTags = {
  type:   string;    // e.g. "T-SHIRT"
  styles: string[];  // e.g. ["CASUAL", "COOL"]
  colour: string;    // e.g. "WHITE"
};

export const TYPE_OPTIONS: Record<string, string[]> = {
  top:    ['T-SHIRT', 'TANK', 'BUTTON-DOWN', 'CARDIGAN', 'CORSET', 'PEPLUM', 'VEST', 'BLOUSE'],
  bottom: ['JEANS', 'TROUSERS', 'SHORTS', 'SKIRT', 'LEGGINGS'],
  shoes:  ['SNEAKERS', 'BOOTS', 'HEELS', 'SANDALS', 'LOAFERS', 'FLATS'],
};

export const STYLE_OPTIONS = ['CUTE', 'NOSTALGIC', 'COOL', 'CLASSIC', 'BOLD', 'CASUAL', 'COMFY', 'ELEGANT'];
export const COLOUR_OPTIONS = ['RED', 'ORANGE', 'YELLOW', 'GREEN', 'LIGHT BLUE', 'PURPLE', 'PINK', 'BLACK', 'GRAY', 'WHITE'];

/**
 * Reconstruct structured ClothingTags from a flat tag array (the format stored
 * in Supabase). Matches each tag against the canonical TYPE / STYLE / COLOUR
 * vocab — custom user tags are ignored. Returns undefined when nothing matches,
 * so the filter treats the item as untagged rather than unmatchable.
 */
export function parseTags(tags: string[]): ClothingTags | undefined {
  const allTypes = Object.values(TYPE_OPTIONS).flat();
  const upper    = tags.map((t) => t.toUpperCase().trim());

  const type   = upper.find((t) => allTypes.includes(t));
  const styles = upper.filter((t) => STYLE_OPTIONS.includes(t));
  const colour = upper.find((t) => COLOUR_OPTIONS.includes(t));

  if (!type && styles.length === 0 && !colour) return undefined;
  return { type: type ?? '', styles, colour: colour ?? '' };
}

type ClaudeImageSource =
  | { sourceType: 'url';    url: string }
  | { sourceType: 'base64'; base64: string; mediaType: 'image/jpeg' | 'image/png' };

// ── Downscale local photos before tagging ─────────────────────────────────────
// Full-res camera captures can exceed the API's ~5MB image limit and make
// tagging fail intermittently. 1024px @ 0.8 JPEG is plenty for tagging.
async function downscaleForTagging(uri: string): Promise<ClaudeImageSource | null> {
  try {
    // Dynamic import keeps this module loadable in environments without the
    // native module (e.g. tests).
    const ImageManipulator = await import('expo-image-manipulator');
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (result.base64) {
      return { sourceType: 'base64', base64: result.base64, mediaType: 'image/jpeg' };
    }
  } catch (err) {
    console.warn('[claude] downscale failed, sending original:', err);
  }
  return null;
}

// Convert any image URI to a Claude-compatible image source.
// Handles: https:// (Supabase public URLs), data:, file://
async function uriToClaudeImage(uri: string): Promise<ClaudeImageSource> {
  // https:// → use Claude's URL source (no base64 conversion needed)
  if (uri.startsWith('https://') || uri.startsWith('http://')) {
    return { sourceType: 'url', url: uri };
  }

  // data: URI — extract base64 directly
  if (uri.startsWith('data:')) {
    const commaIdx    = uri.indexOf(',');
    const semicolonIdx = uri.indexOf(';');
    const mediaType   = uri.slice(5, semicolonIdx) as 'image/jpeg' | 'image/png';
    return { sourceType: 'base64', base64: uri.slice(commaIdx + 1), mediaType };
  }

  // file:// URI — downscale first (avoids the API's image size limit) …
  const downscaled = await downscaleForTagging(uri);
  if (downscaled) return downscaled;

  // … falling back to raw blob → base64 if the manipulator is unavailable
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
    return { sourceType: 'base64', base64: dataUri.slice(commaIdx + 1), mediaType };
  }

  // Fallback: arrayBuffer → btoa
  const buffer = await blob.arrayBuffer();
  const bytes  = new Uint8Array(buffer);
  let binary   = '';
  const CHUNK  = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK)
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return { sourceType: 'base64', base64: btoa(binary), mediaType: 'image/jpeg' };
}

// Build the Claude API image content block from a source
function buildImageContent(src: ClaudeImageSource) {
  if (src.sourceType === 'url') {
    return { type: 'image' as const, source: { type: 'url' as const, url: src.url } };
  }
  return {
    type:   'image' as const,
    source: { type: 'base64' as const, media_type: src.mediaType, data: src.base64 },
  };
}

/**
 * Auto-tag a clothing item using structured fields (type, styles, colour).
 * Accepts any URI: https:// (Supabase), data:, or file://.
 * Returns exactly 3 tags: [type, topStyle, colour].
 */
export async function tagClothingItemStructured(
  imageUri: string,
  category: 'top' | 'bottom' | 'shoes',
): Promise<ClothingTags> {
  const src   = await uriToClaudeImage(imageUri);
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
          buildImageContent(src),
          {
            type: 'text',
            text: `Analyze this ${category} clothing item and return a JSON object with exactly these fields:
- "type": pick ONE from [${types.join(', ')}]
- "styles": pick EXACTLY ONE from [${STYLE_OPTIONS.join(', ')}] that best matches the vibe
- "colour": pick ONE from [${COLOUR_OPTIONS.join(', ')}] for the dominant colour

Return ONLY the JSON object, no commentary. Example: {"type":"T-SHIRT","styles":["CASUAL"],"colour":"WHITE"}`,
          },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`[claude] tagging failed ${res.status}:`, body.slice(0, 300));
    throw new Error(`Claude tagging failed: ${res.status}`);
  }
  const data = await res.json();

  // Strip markdown fences if the model wrapped the JSON (```json ... ```)
  const raw  = (data.content?.[0]?.text ?? '') as string;
  const json = raw.replace(/```(?:json)?/g, '').trim();
  const tags = JSON.parse(json) as ClothingTags;

  // Enforce exactly 1 style — pick the most relevant if Claude returns more
  return { ...tags, styles: (tags.styles ?? []).slice(0, 1) };
}

/**
 * Flatten ClothingTags into an ordered 3-element string array: [type, style, colour].
 * This is the canonical tag format stored in Supabase and displayed as pills.
 */
export function flattenTags(tags: ClothingTags): [string, string, string] {
  return [tags.type, tags.styles[0] ?? '', tags.colour];
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
