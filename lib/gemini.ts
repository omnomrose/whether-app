// Google Gemini Flash — clothing auto-tagging (replaces Claude for tagging).
//
// Why Gemini here: the Gemini API has a free tier (Google AI Studio key),
// so auto-tagging keeps working without prepaid credits. Outfit suggestions
// still use Claude (lib/claude.ts).
//
// Setup: add EXPO_PUBLIC_GEMINI_API_KEY to .env — free key from
// https://aistudio.google.com/apikey

import {
  type ClothingTags,
  TYPE_OPTIONS,
  STYLE_OPTIONS,
  COLOUR_OPTIONS,
} from './claude';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY!;
// gemini-3.1-flash-lite: current stable budget multimodal model.
// NOTE: gemini-2.5-flash and older return 404 for new API keys, and
// 2.0-flash was fully shut down June 2026 — don't downgrade this.
const MODEL = 'gemini-3.1-flash-lite';
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type InlineData = { mimeType: string; data: string };

// ── Downscale local photos before tagging ─────────────────────────────────────
// Image tokens scale with pixel count — 512px is plenty for type/style/colour.
async function downscaleToBase64(uri: string): Promise<InlineData | null> {
  try {
    const ImageManipulator = await import('expo-image-manipulator');
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 512 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (result.base64) return { mimeType: 'image/jpeg', data: result.base64 };
  } catch (err) {
    console.warn('[gemini] downscale failed, sending original:', err);
  }
  return null;
}

// Gemini has no URL image source — everything must be inline base64.
// Handles data:, file://, and https:// (Supabase public URLs) URIs.
async function uriToInlineData(uri: string): Promise<InlineData> {
  // data: URI — extract base64 directly
  if (uri.startsWith('data:')) {
    const commaIdx     = uri.indexOf(',');
    const semicolonIdx = uri.indexOf(';');
    return { mimeType: uri.slice(5, semicolonIdx), data: uri.slice(commaIdx + 1) };
  }

  // file:// — downscale first (also converts to base64)
  if (uri.startsWith('file://')) {
    const downscaled = await downscaleToBase64(uri);
    if (downscaled) return downscaled;
  }

  // https:// (or file:// fallback) — fetch → blob → base64
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
    const commaIdx     = dataUri.indexOf(',');
    const semicolonIdx = dataUri.indexOf(';');
    return { mimeType: dataUri.slice(5, semicolonIdx), data: dataUri.slice(commaIdx + 1) };
  }

  // Fallback: arrayBuffer → btoa
  const buffer = await blob.arrayBuffer();
  const bytes  = new Uint8Array(buffer);
  let binary   = '';
  const CHUNK  = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK)
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return { mimeType: blob.type || 'image/jpeg', data: btoa(binary) };
}

// Circuit breaker — missing/invalid key blocks the whole session, but a 429
// (free-tier per-minute rate limit) only triggers a short cooldown: the limit
// resets every 60s, so later attempts (e.g. closet self-heal) should succeed.
let geminiBlocked  = false;
let cooldownUntil  = 0;
const COOLDOWN_MS  = 65_000;

/**
 * Auto-tag a clothing item using Gemini Flash.
 * Same contract as the old Claude version: accepts any URI
 * (https://, data:, file://) and returns structured ClothingTags.
 */
export async function tagClothingItemStructured(
  imageUri: string,
  category: 'top' | 'bottom' | 'shoes',
): Promise<ClothingTags> {
  if (geminiBlocked) throw new Error('Gemini tagging skipped: invalid/missing API key');
  if (Date.now() < cooldownUntil)
    throw new Error('Gemini tagging cooling down after rate limit — retrying soon');
  if (!GEMINI_API_KEY) {
    geminiBlocked = true;
    throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY');
  }

  const inline = await uriToInlineData(imageUri);
  const types  = TYPE_OPTIONS[category] ?? TYPE_OPTIONS.top;

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': GEMINI_API_KEY,
      'content-type':   'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: inline.mimeType, data: inline.data } },
          {
            text: `Analyze this ${category} clothing item and return a JSON object with exactly these fields:
- "type": pick ONE from [${types.join(', ')}]
- "styles": array with EXACTLY ONE pick from [${STYLE_OPTIONS.join(', ')}] that best matches the vibe
- "colour": pick ONE from [${COLOUR_OPTIONS.join(', ')}] for the dominant colour

Return ONLY the JSON object, no commentary. Example: {"type":"T-SHIRT","styles":["CASUAL"],"colour":"WHITE"}`,
          },
        ],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens:  256,
        temperature:      0,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`[gemini] tagging failed ${res.status}:`, body.slice(0, 300));
    // 429 = per-minute rate limit → cool down and retry later.
    // 403 = bad key → no point retrying this session.
    if (res.status === 429) cooldownUntil = Date.now() + COOLDOWN_MS;
    if (res.status === 403) geminiBlocked = true;
    throw new Error(`Gemini tagging failed: ${res.status}`);
  }

  const data = await res.json();
  const raw  = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '') as string;
  const json = raw.replace(/```(?:json)?/g, '').trim();
  const tags = JSON.parse(json) as ClothingTags;

  // Enforce exactly 1 style — pick the first if the model returns more
  return { ...tags, styles: (tags.styles ?? []).slice(0, 1) };
}
