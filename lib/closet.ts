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
//     category     text not null check (category in ('top','bottom','shoes','accessory','outerwear')),
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

import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import type { ClothingItem } from '@/store/closetStore';

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
  const { data, error } = await supabase
    .from('clothing_items')
    .select('id, image_url, storage_path, category, tags, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id:          row.id          as string,
    imageUrl:    row.image_url   as string,
    storagePath: row.storage_path as string,
    category:    row.category    as ClothingItem['category'],
    tags:        (row.tags       as string[]) ?? [],
    createdAt:   row.created_at  as string,
  }));
}

// ── Delete item ────────────────────────────────────────────────────────────────
// Removes the DB row first, then the storage file (best-effort).

export async function deleteClothingItem(
  itemId:      string,
  storagePath: string | undefined,
): Promise<void> {
  const { error } = await supabase
    .from('clothing_items')
    .delete()
    .eq('id', itemId);

  if (error) throw error;

  if (storagePath) {
    // Don't throw — missing file shouldn't block UI
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
  }
}
