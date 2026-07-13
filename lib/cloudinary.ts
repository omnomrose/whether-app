// Background removal — Cloudinary
//
// Flow:
//   1. Unsigned upload (multipart) to Cloudinary using an upload preset —
//      no API secret needed in the app, only the cloud name + preset name.
//   2. Build a delivery URL with the e_background_removal effect + f_png.
//   3. First request for that URL kicks off async processing — Cloudinary
//      returns 423 (Locked) until ready, so we poll before resolving.
//
// Docs: https://cloudinary.com/documentation/effects_and_artistic_enhancements#background_removal

const CLOUD_NAME    = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_TRIES   = 20; // ~30s ceiling

interface CloudinaryUploadResponse {
  public_id: string;
  version:   number;
  format:    string;
}

async function upload(imageUri: string): Promise<CloudinaryUploadResponse> {
  const form = new FormData();
  // RN's FormData accepts { uri, type, name } for file parts.
  form.append('file', {
    uri:  imageUri,
    type: 'image/jpeg',
    name: 'capture.jpg',
  } as unknown as Blob);
  form.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cloudinary upload ${res.status}: ${body}`);
  }
  return res.json();
}

/** Poll a transformation URL until Cloudinary finishes async processing. */
async function waitUntilReady(url: string): Promise<void> {
  for (let i = 0; i < POLL_MAX_TRIES; i++) {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) return;
    if (res.status !== 423) {
      throw new Error(`Cloudinary transform failed: ${res.status}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error('Cloudinary background removal timed out');
}

/**
 * Remove the background via Cloudinary.
 * Returns a hosted PNG URL with transparent background.
 */
export async function removeBackgroundCloudinary(imageUri: string): Promise<string> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      '[bg-removal] EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME / EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET not set'
    );
  }

  console.log('[bg-removal:cloudinary] → uri:', imageUri?.slice(0, 60));
  const { public_id, version } = await upload(imageUri);

  const resultUrl =
    `https://res.cloudinary.com/${CLOUD_NAME}/image/upload` +
    `/e_background_removal/f_png/v${version}/${public_id}.png`;

  await waitUntilReady(resultUrl);
  console.log('[bg-removal:cloudinary] ← ready:', resultUrl);
  return resultUrl;
}
