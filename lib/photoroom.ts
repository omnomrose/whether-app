// Background removal — Cloudinary only.
//
// Implementation lives in lib/cloudinary.ts (unsigned upload + e_background_removal).
// The old withoutBG integration was removed 2026-07-12 — it was silently
// swallowing Cloudinary failures and burning withoutBG credits. Errors now
// propagate to callers (camera-scan.tsx already surfaces them via setBgError).
// The withoutBG code is in git history if ever needed again.

export { removeBackgroundCloudinary as removeBackground } from "./cloudinary";
