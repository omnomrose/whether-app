// Background removal — withoutBG API
// https://withoutbg.com/documentation/api/background-removal-base64
//
// Flow:
//   1. Read local file URI → base64 string
//   2. POST JSON { image_base64 } to withoutBG
//   3. Response JSON contains img_without_background_base64
//   4. Prepend data URI prefix → ready for RN's Image component

const WITHOUTBG_API_KEY = process.env.EXPO_PUBLIC_WITHOUTBG_API_KEY!;
const WITHOUTBG_URL     = "https://api.withoutbg.com/v1.0/image-without-background-base64";

// Convert a local file:// URI to a raw base64 string (no data URI prefix).
async function uriToBase64(imageUri: string): Promise<string> {
  const res  = await fetch(imageUri);
  const blob = await res.blob();

  // Try FileReader first (available in RN via RCTFileReaderModule)
  const FR = (globalThis as any).FileReader;
  if (typeof FR !== "undefined") {
    const dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FR();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = (e: unknown) => reject(e);
      reader.readAsDataURL(blob);
    });
    // Strip "data:image/jpeg;base64," prefix — withoutBG wants raw base64
    return dataUri.split(",")[1];
  }

  // Fallback: arrayBuffer → btoa
  const buffer = await blob.arrayBuffer();
  const bytes  = new Uint8Array(buffer);
  let binary   = "";
  const CHUNK  = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export async function removeBackground(imageUri: string): Promise<string> {
  console.log("[bg-removal] → uri:", imageUri?.slice(0, 60));

  if (!WITHOUTBG_API_KEY) {
    throw new Error("[bg-removal] EXPO_PUBLIC_WITHOUTBG_API_KEY is not set");
  }

  const imageBase64 = await uriToBase64(imageUri);
  console.log("[bg-removal] base64 length:", imageBase64.length);

  const res = await fetch(WITHOUTBG_URL, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key":    WITHOUTBG_API_KEY,
    },
    body: JSON.stringify({ image_base64: imageBase64 }),
  });

  console.log("[bg-removal] ← status:", res.status);

  if (!res.ok) {
    const body = await res.text();
    console.error("[bg-removal] error:", body);
    throw new Error(`withoutBG ${res.status}: ${body}`);
  }

  const data = await res.json();
  const resultBase64: string = data.img_without_background_base64;
  console.log("[bg-removal] result base64 length:", resultBase64?.length);

  return `data:image/png;base64,${resultBase64}`;
}
