// Weather-aware outfit selection
//
// Picks 1 top, 1 bottom, 1 shoe from the closet based on weather conditions.
// Rule-based scorer — deterministic and instant (no Claude call).
//
// Scoring strategy:
//   • Tags include [type, style, colour] from tagClothingItemStructured
//   • Rules check both type tags (T-SHIRT, BOOTS…) and style tags (CASUAL, COMFY…)
//   • Higher score = more appropriate for the weather

import type { ClothingItem } from '@/store/closetStore';
import type { WeatherData } from '@/store/weatherStore';
import type { CurrentOutfit } from '@/store/outfitStore';

// WMO codes that indicate precipitation
const RAIN_CODES  = new Set([51,53,55,61,63,65,80,81,82]);
const SNOW_CODES  = new Set([71,73,75,77,85,86]);
const STORM_CODES = new Set([95,96,99]);

function isWet(code: number): boolean {
  return RAIN_CODES.has(code) || STORM_CODES.has(code);
}
function isSnowy(code: number): boolean {
  return SNOW_CODES.has(code);
}

function scoreItem(item: ClothingItem, temp: number, conditionCode: number): number {
  const tags = item.tags.map((t) => t.toUpperCase());
  let score = 0;

  const hot     = temp > 22;
  const warm    = temp >= 15 && temp <= 22;
  const cool    = temp >= 5  && temp < 15;
  const cold    = temp < 5;
  const wet     = isWet(conditionCode);
  const snowy   = isSnowy(conditionCode);

  // ── Top scoring ───────────────────────────────────────────────────────────
  if (item.category === 'top') {
    if (hot)  {
      if (tags.includes('TANK') || tags.includes('T-SHIRT'))     score += 4;
      if (tags.includes('CASUAL') || tags.includes('COOL'))      score += 2;
      if (tags.includes('CARDIGAN') || tags.includes('VEST'))    score -= 2;
    }
    if (warm) {
      if (tags.includes('T-SHIRT') || tags.includes('BLOUSE'))   score += 3;
      if (tags.includes('BUTTON-DOWN'))                          score += 3;
      if (tags.includes('CASUAL') || tags.includes('CLASSIC'))   score += 2;
    }
    if (cool) {
      if (tags.includes('BUTTON-DOWN') || tags.includes('BLOUSE')) score += 3;
      if (tags.includes('CARDIGAN') || tags.includes('VEST'))    score += 4;
      if (tags.includes('COMFY') || tags.includes('CLASSIC'))    score += 2;
      if (tags.includes('TANK'))                                 score -= 2;
    }
    if (cold) {
      if (tags.includes('CARDIGAN') || tags.includes('VEST'))    score += 5;
      if (tags.includes('BUTTON-DOWN'))                          score += 3;
      if (tags.includes('COMFY') || tags.includes('CLASSIC'))    score += 2;
      if (tags.includes('TANK') || tags.includes('T-SHIRT'))     score -= 3;
    }
  }

  // ── Bottom scoring ────────────────────────────────────────────────────────
  if (item.category === 'bottom') {
    if (hot) {
      if (tags.includes('SHORTS') || tags.includes('SKIRT'))     score += 4;
      if (tags.includes('LEGGINGS'))                             score += 2;
      if (tags.includes('JEANS') || tags.includes('TROUSERS'))   score -= 1;
    }
    if (warm || cool) {
      if (tags.includes('JEANS') || tags.includes('TROUSERS'))   score += 3;
      if (tags.includes('SKIRT'))                                score += 2;
      if (tags.includes('CASUAL') || tags.includes('CLASSIC'))   score += 2;
    }
    if (cold || snowy) {
      if (tags.includes('JEANS') || tags.includes('TROUSERS'))   score += 4;
      if (tags.includes('LEGGINGS'))                             score += 3;
      if (tags.includes('SHORTS') || tags.includes('SKIRT'))     score -= 3;
    }
  }

  // ── Shoes scoring ─────────────────────────────────────────────────────────
  if (item.category === 'shoes') {
    if (wet || snowy) {
      if (tags.includes('BOOTS'))                                score += 5;
      if (tags.includes('SANDALS') || tags.includes('FLATS'))    score -= 4;
      if (tags.includes('LOAFERS'))                              score -= 1;
    }
    if (hot) {
      if (tags.includes('SANDALS') || tags.includes('LOAFERS'))  score += 4;
      if (tags.includes('FLATS'))                                score += 3;
      if (tags.includes('BOOTS'))                                score -= 2;
    }
    if (cool || cold) {
      if (tags.includes('BOOTS'))                                score += 4;
      if (tags.includes('SNEAKERS'))                             score += 3;
      if (tags.includes('SANDALS'))                              score -= 3;
    }
    if (warm) {
      if (tags.includes('SNEAKERS') || tags.includes('LOAFERS')) score += 3;
      if (tags.includes('FLATS'))                                score += 2;
    }
  }

  return score;
}

/** Pick the best-scoring item from a list. Ties broken by index (first added). */
function pickBest(candidates: ClothingItem[], temp: number, code: number): ClothingItem | undefined {
  if (!candidates.length) return undefined;
  return candidates.reduce<ClothingItem>((best, item) =>
    scoreItem(item, temp, code) > scoreItem(best, temp, code) ? item : best,
    candidates[0],
  );
}

/**
 * Select 1 top, 1 bottom, 1 shoe from the closet based on current weather.
 * Returns immediately — no async calls. Safe to call on every render.
 *
 * @param offset  Rotate the ranked list by this many positions (for "refresh" shuffling)
 */
export function selectWeatherOutfit(
  weather: WeatherData,
  items: ClothingItem[],
  offset = 0,
): CurrentOutfit {
  if (!weather || !items.length) return {};

  const { temp, conditionCode } = weather;

  // Sort each category by score descending, then rotate by offset
  const ranked = (cat: ClothingItem['category']) => {
    const pool = items
      .filter((i) => i.category === cat)
      .sort((a, b) => scoreItem(b, temp, conditionCode) - scoreItem(a, temp, conditionCode));
    if (!pool.length) return undefined;
    return pool[offset % pool.length];
  };

  return {
    top:    ranked('top'),
    bottom: ranked('bottom'),
    shoes:  ranked('shoes'),
  };
}
