// Scan session store — shared state between camera-scan and photo-confirm.
//
// Onboarding closet flow (front-only):
//   3 tops → 2 bottoms → 1 shoes  =  6 captures total
//
// State machine:
//   camera-scan   → addCapture(rawUri)           → stay on camera, kick off BG removal
//   camera-scan   → setBgRemoved(id, uri)         → update photo after API returns
//   camera-scan   → setProcessing(id, bool)       → track loading state on thumbnail
//   photo-confirm → confirmToCloset(id)           → mark photo as added to closet
//   photo-confirm → retakePhoto(id)               → remove photo, rewind step
//
// completed becomes true when every photo is added to closet.

import { create } from 'zustand';

// ─── Step definitions ─────────────────────────────────────────────────────────
export const SCAN_STEPS = [
  { category: 'top'    as const, label: 'TOPS',    prompt: 'FIND THREE TOPS IN YOUR ROTATION'            },
  { category: 'top'    as const, label: 'TOPS',    prompt: 'SNAP ANOTHER TOP FROM YOUR ROTATION'         },
  { category: 'top'    as const, label: 'TOPS',    prompt: 'ONE LAST TOP FROM YOUR ROTATION'              },
  { category: 'bottom' as const, label: 'BOTTOMS', prompt: 'GRAB TWO BOTTOMS FROM YOUR CLOSET'            },
  { category: 'bottom' as const, label: 'BOTTOMS', prompt: 'ONE MORE BOTTOM FROM YOUR ROTATION'           },
  { category: 'shoes'  as const, label: 'SHOES',   prompt: 'SNAP YOUR GO-TO PAIR OF SHOES'               },
] as const;

export type ScanCategory = 'top' | 'bottom' | 'shoes';

export type ScanPhoto = {
  id:            string;
  rawUri:        string;
  /** data:image/png;base64,... set after PhotoRoom returns. null while processing or on failure. */
  bgRemovedUri:  string | null;
  /** True while removeBackground() is in flight. */
  isProcessing:  boolean;
  /** Error message if removeBackground() threw — null when not yet run or successful. */
  bgError:       string | null;
  stepIndex:     number;
  category:      ScanCategory;
  /** True once user confirms this photo to their closet from photo-confirm. */
  addedToCloset: boolean;
};

type ScanStore = {
  /** Next capture step index (0–5). Equals SCAN_STEPS.length when all shots taken. */
  stepIndex:  number;
  /** All photos captured this session (regardless of closet status). */
  photos:     ScanPhoto[];
  /** True when every photo has been added to the closet. Navigate to main app. */
  completed:  boolean;

  // ── Actions ───────────────────────────────────────────────────────────────
  /**
   * Called immediately after camera captures a photo.
   * Adds the photo to the store, advances stepIndex, returns the new photo ID
   * so the caller can associate the BG removal result.
   */
  addCapture: (rawUri: string) => string;
  /** Update a photo's bg-removed URI after the API returns. */
  setBgRemoved: (id: string, uri: string | null) => void;
  /** Set a bg-removal error message (shown in UI so we can debug). */
  setBgError: (id: string, msg: string | null) => void;
  /** Toggle the per-photo processing flag. */
  setProcessing: (id: string, val: boolean) => void;
  /**
   * Mark a photo as confirmed to the closet.
   * Sets completed=true when all SCAN_STEPS photos are confirmed.
   */
  confirmToCloset: (id: string) => void;
  /**
   * Remove a photo from the session and rewind stepIndex so the camera
   * re-shoots that step. All photos captured after this step are also removed
   * to keep the ordering gap-free.
   */
  retakePhoto: (id: string) => void;
  /** Full reset (e.g. re-entering onboarding). */
  reset: () => void;
};

export const useScanStore = create<ScanStore>((set) => ({
  stepIndex: 0,
  photos:    [],
  completed: false,

  addCapture: (rawUri) => {
    const id = Date.now().toString();
    set((state) => {
      const stepIdx   = Math.min(state.stepIndex, SCAN_STEPS.length - 1);
      const newPhoto: ScanPhoto = {
        id,
        rawUri,
        bgRemovedUri:  null,
        isProcessing:  true,
        bgError:       null,
        stepIndex:     stepIdx,
        category:      SCAN_STEPS[stepIdx].category,
        addedToCloset: false,
      };
      return {
        photos:    [...state.photos, newPhoto],
        stepIndex: state.stepIndex + 1,   // advance BEFORE BG removal finishes
      };
    });
    return id;
  },

  setBgRemoved: (id, uri) =>
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === id ? { ...p, bgRemovedUri: uri } : p,
      ),
    })),

  setBgError: (id, msg) =>
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === id ? { ...p, bgError: msg } : p,
      ),
    })),

  setProcessing: (id, val) =>
    set((state) => ({
      photos: state.photos.map((p) =>
        p.id === id ? { ...p, isProcessing: val } : p,
      ),
    })),

  confirmToCloset: (id) =>
    set((state) => {
      const photos    = state.photos.map((p) =>
        p.id === id ? { ...p, addedToCloset: true } : p,
      );
      const completed =
        photos.length >= SCAN_STEPS.length &&
        photos.every((p) => p.addedToCloset);
      return { photos, completed };
    }),

  retakePhoto: (id) =>
    set((state) => {
      const photo = state.photos.find((p) => p.id === id);
      if (!photo) return state;
      // Remove this photo and all captures from later steps (keeps ordering clean)
      const photos = state.photos.filter((p) => p.stepIndex < photo.stepIndex);
      return { photos, stepIndex: photo.stepIndex, completed: false };
    }),

  reset: () => set({ stepIndex: 0, photos: [], completed: false }),
}));
