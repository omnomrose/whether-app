// Supabase photo storage + clothing_items DB helpers.
//
// ─── ONE-TIME SUPABASE SETUP ──────────────────────────────────────────────────
//
// 1. In Supabase Dashboard → Storage → New bucket:
//    Name: closet-images   Public: YES   (enables public URL reads without auth)
//
// 2. In Supabase Dashboard → SQL Editor → run:
//
//   create table clothing_items (
//     id           uuid default gen_random_uuid() primary key,
//     user_id      uuid references auth.users(id) on delete cascade not null,
//     image_url    text not null,
//     storage_path text not null,
//     category     text not null check (category in ('top','bottom','shoes','accessory','outerwear','jewelry')),
//
//   If the table already exists with the old constraint, run:
//     alter table clothing_items drop constraint clothing_items_category_check;
//     alter table clothing_items add constraint clothing_items_category_check
//       check (category in ('top','bottom','shoes','accessory','outerwear','jewelry'));
//     tags         text[] not null default '{}',
//     created_at   timestamptz default now() not null
//   );
//
//   alter table clothing_items enable row level security;
//
//   create policy "Users manage their own items"
//     on clothing_items for all
//     using  (auth.uid() = user_id)
//     with check (auth.uid() = user_id);
//
// ─────────────────────────────────────────────────────────────────────────────

// SDK 54: readAsStringAsync/EncodingType live in the legacy entry point —
// the root export is the new File/Directory API (EncodingType is undefined there).
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import type { ClothingItem } from '@/store/closetStore';
import { flattenTags, parseTags } from './claude';
import { tagClothingItemStructured } from './gemini';

const BUCKET = 'closet-images';

// ── URI helpers ───────────────────────────────────────────────────────────────
// bgRemovedUri from withoutBG comes back as "data:image/png;base64,..."
// rawUri from expo-camera is a local file:// path.

function isDataUri(uri: string) {
  return uri.startsWith('data:');
}

async function uriToBase64AndType(
  uri: string,
): Promise<{ base64: string; contentType: string }> {
  if (isDataUri(uri)) {
    // "data:image/png;base64,<payload>" — extract type + payload
    const [header, base64] = uri.split(',');
    const contentType = header.split(':')[1].split(';')[0]; // "image/png"
    return { base64, contentType };
  }
  // file:// path — read from disk
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { base64, contentType: 'image/jpeg' };
}

// ── Upload ─────────────────────────────────────────────────────────────────────
// Takes any URI (data: or file://) and uploads to the closet-images bucket.
// Returns the public URL and the storage path (needed for future deletes).

export async function uploadClothingPhoto(
  uri:    string,
  userId: string,
): Promise<{ publicUrl: string; storagePath: string }> {
  const { base64, contentType } = await uriToBase64AndType(uri);
  const ext         = contentType === 'image/png' ? 'png' : 'jpg';
  const storagePath = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, decode(base64), { contentType, upsert: false });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  return { publicUrl, storagePath };
}

// ── Insert DB record ───────────────────────────────────────────────────────────
// Returns the Supabase-generated UUID for this item.

export async function saveClothingItem(params: {
  userId:      string;
  imageUrl:    string;
  storagePath: string;
  category:    ClothingItem['category'];
  tags:        string[];
}): Promise<string> {
  const { data, error } = await supabase
    .from('clothing_items')
    .insert({
      user_id:      params.userId,
      image_url:    params.imageUrl,
      storage_path: params.storagePath,
      category:     params.category,
      tags:         params.tags,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

// ── Fetch all items for a user ─────────────────────────────────────────────────

export async function fetchClosetItems(userId: string): Promise<ClothingItem[]> {
  // Try including the custom `name` column; fall back gracefully if the
  // column hasn't been added to the table yet (see updateClothingName).
  const withName = await supabase
    .from('clothing_items')
    .select('id, image_url, storage_path, category, tags, created_at, name')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  let data:  Record<string, unknown>[] | null = withName.data;
  let error = withName.error;

  if (error) {
    const fallback = await supabase
      .from('clothing_items')
      .select('id, image_url, storage_path, category, tags, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    data  = fallback.data;
    error = fallback.error;
  }

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const tags = (row.tags as string[]) ?? [];
    return {
      id:           row.id          as string,
      name:         (row.name as string | null) ?? undefined,
      imageUrl:     row.image_url   as string,
      storagePath:  row.storage_path as string,
      category:     row.category    as ClothingItem['category'],
      tags,
      // Rebuild structured tags from the flat array so filters work on
      // cloud-synced items (clothingTags is not stored as its own column).
      clothingTags: parseTags(tags),
      createdAt:    row.created_at  as string,
    };
  });
}

// ── Update tags ────────────────────────────────────────────────────────────────

export async function updateClothingTags(
  itemId: string,
  tags:   string[],
): Promise<void> {
  // Local-only items have non-UUID ids — nothing in the cloud to update.
  // (Passing them to Postgres throws `invalid input syntax for type uuid`.)
  if (!UUID_RE.test(itemId)) return;

  const { error } = await supabase
    .from('clothing_items')
    .update({ tags })
    .eq('id', itemId);

  if (error) throw error;
}

// ── Rename item ────────────────────────────────────────────────────────────────
// Best-effort cloud sync: the local rename (Zustand + AsyncStorage) always
// works; the DB write needs a `name` column on clothing_items. Add it once in
// the Supabase SQL editor:
//   alter table clothing_items add column if not exists name text;

export async function updateClothingName(
  itemId: string,
  name:   string | null,
): Promise<void> {
  if (!UUID_RE.test(itemId)) return; // local-only item
  const { error } = await supabase
    .from('clothing_items')
    .update({ name })
    .eq('id', itemId);
  if (error) console.warn('[closet] rename cloud sync failed (add `name` column?):', error.message);
}

// ── Retag a single item via Claude ────────────────────────────────────────────
// Calls Claude vision on the item's public Supabase URL, updates DB + returns
// the new 3-tag array. Safe to call with any imageUrl (https://).

export async function retagClosetItem(
  item: Pick<ClothingItem, 'id' | 'imageUrl' | 'category'> & Partial<Pick<ClothingItem, 'tags'>>,
): Promise<string[]> {
  const category = item.category as 'top' | 'bottom' | 'shoes';
  // Gracefully skip unsupported categories
  if (!['top', 'bottom', 'shoes'].includes(category)) return item.id ? [] : [];

  const result = await tagClothingItemStructured(item.imageUrl, category);
  const tags   = Array.from(flattenTags(result)); // [type, style, colour]

  // Preserve any custom tags the user typed in (anything outside the
  // canonical TYPE/STYLE/COLOUR vocab and old fallback set).
  const existing = (item as ClothingItem).tags ?? [];
  const custom   = existing.filter(
    (t) => !isVocabTag(t) && !OLD_FALLBACK_TAGS.has(t.toUpperCase()),
  );

  const merged = [...tags, ...custom];
  await updateClothingTags(item.id, merged);
  return merged;
}

// ── Migrate all items for a user that have 0 tags or old fallback tags ─────────
// Runs silently in the background — errors per item are swallowed.
// Returns a map of { itemId → newTags } for the caller to update local state.

const OLD_FALLBACK_TAGS = new Set([
  'CASUAL','EVERYDAY','LAYERING','DENIM','SNEAKERS','COMFORTABLE',
]);

// Is this tag part of the canonical filter vocab (TYPE / STYLE / COLOUR)?
function isVocabTag(tag: string): boolean {
  const parsed = parseTags([tag]);
  return parsed !== undefined;
}

function needsRetag(tags: string[]): boolean {
  if (tags.length === 0) return true;
  // All tags are from the old hardcoded fallback set → retag
  if (tags.every((t) => OLD_FALLBACK_TAGS.has(t))) return true;
  // Every filterable item needs BOTH a type and a colour from the canonical
  // vocab (style is a bonus third tag). Missing either → retag so the item
  // matches type/colour filters. Custom tags are preserved by retagClosetItem.
  const parsed = parseTags(tags);
  return !parsed || !parsed.type || !parsed.colour;
}

export async function migrateClosetTags(
  items: ClothingItem[],
): Promise<Record<string, string[]>> {
  const results: Record<string, string[]> = {};
  const stale = items.filter(
    (i) => needsRetag(i.tags) && ['top','bottom','shoes'].includes(i.category),
  );

  // Sequential with a small gap — parallel bursts trip the Gemini free-tier
  // per-minute rate limit (429), which used to kill tagging for the session.
  for (const item of stale) {
    try {
      const newTags = await retagClosetItem(item);
      results[item.id] = newTags;
    } catch {
      // Silent — old tags stay in place, self-heal retries later
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  return results;
}

// ── Delete item ────────────────────────────────────────────────────────────────
// Removes the DB row first, then the storage file (best-effort).
//
// Handles two edge cases that used to make "REMOVE ITEM" appear broken:
//   1. Local-only items (upload failed at scan time) have non-UUID ids —
//      passing those to Postgres threw `invalid input syntax for type uuid`.
//      Now we skip the cloud delete entirely for them.
//   2. Stale-session deletes: RLS silently blocks the delete (0 rows, no
//      error), the item disappears locally, then resurrects on next closet
//      fetch. We now verify the row is actually gone and throw if not.

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deleteClothingItem(
  itemId:      string,
  storagePath: string | undefined,
): Promise<void> {
  // Local-only item — nothing in the cloud to delete.
  if (UUID_RE.test(itemId)) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('Not signed in — please sign in to remove items.');
    }

    const { data, error } = await supabase
      .from('clothing_items')
      .delete()
      .eq('id', itemId)
      .select('id');

    if (error) throw error;

    // 0 rows deleted — either already gone (fine) or RLS blocked it.
    if (!data || data.length === 0) {
      const { data: still } = await supabase
        .from('clothing_items')
        .select('id')
        .eq('id', itemId)
        .maybeSingle();
      if (still) {
        throw new Error('Could not remove item from cloud — try signing in again.');
      }
    }
  }

  if (storagePath) {
    // Don't throw — missing file shouldn't block UI
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
  }
}
