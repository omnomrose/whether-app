// PhotoRoom API — background removal for clothing images
// Sandbox mode: free, results are watermarked (fine for development)
// Switch to production key when ready for real users

const PHOTOROOM_API_KEY = process.env.EXPO_PUBLIC_PHOTOROOM_API_KEY!;
const PHOTOROOM_URL = "https://image-api.photoroom.com/v2/segment";

export async function removeBackground(imageUri: string): Promise<Blob> {
  const formData = new FormData();
  formData.append("image_file", {
    uri: imageUri,
    name: "clothing.jpg",
    type: "image/jpeg",
  } as any);

  const res = await fetch(PHOTOROOM_URL, {
    method: "POST",
    headers: {
      "x-api-key": PHOTOROOM_API_KEY,
    },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`PhotoRoom error: ${error}`);
  }

  return res.blob();
}
