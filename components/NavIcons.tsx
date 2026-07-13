/**
 * NavIcons — exact nav bar icons from Figma node 653:78.
 *
 * Drawn as react-native-svg vectors matching the design's shapes 1:1:
 *   • ClosetIcon  (653:64, 19×19) — wardrobe: rounded cabinet, centre seam,
 *     two small handles either side of the seam
 *   • CameraIcon  (672:168, 19×17) — camera body, top viewfinder bump, lens
 *   • CloudIcon   (653:73, 19×14) — puffy cloud outline, flat bottom
 *
 * All take `color` + optional `size` (width; height keeps the design ratio).
 */

import Svg, { Rect, Path, Circle, Line } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number; // width in px — height scales per design ratio
}

// ── Closet / wardrobe — Figma 653:64 (19×19) ──────────────────────────────────
export function ClosetIcon({ color, size = 19 }: IconProps) {
  const h = size; // square
  return (
    <Svg width={size} height={h} viewBox="0 0 19 19" fill="none">
      {/* Cabinet body */}
      <Rect
        x={3.25} y={1.25} width={12.5} height={16.5} rx={1.75}
        stroke={color} strokeWidth={1.5}
      />
      {/* Centre seam */}
      <Line
        x1={9.5} y1={1.5} x2={9.5} y2={17.5}
        stroke={color} strokeWidth={1.5}
      />
      {/* Handles — short vertical ticks either side of the seam */}
      <Line
        x1={7.4} y1={7.6} x2={7.4} y2={10.4}
        stroke={color} strokeWidth={1.5} strokeLinecap="round"
      />
      <Line
        x1={11.6} y1={7.6} x2={11.6} y2={10.4}
        stroke={color} strokeWidth={1.5} strokeLinecap="round"
      />
    </Svg>
  );
}

// ── Camera — Figma 672:168 (19×17) ────────────────────────────────────────────
export function CameraIcon({ color, size = 19 }: IconProps) {
  const h = (17 / 19) * size;
  return (
    <Svg width={size} height={h} viewBox="0 0 19 17" fill="none">
      {/* Viewfinder bump */}
      <Path
        d="M6.5 3.25V2.5C6.5 1.81 7.06 1.25 7.75 1.25H11.25C11.94 1.25 12.5 1.81 12.5 2.5V3.25"
        stroke={color} strokeWidth={1.5} strokeLinecap="round"
      />
      {/* Body */}
      <Rect
        x={0.75} y={3.25} width={17.5} height={12.5} rx={2.5}
        stroke={color} strokeWidth={1.5}
      />
      {/* Lens */}
      <Circle
        cx={9.5} cy={9.5} r={3.4}
        stroke={color} strokeWidth={1.5}
      />
    </Svg>
  );
}

// ── Weather cloud — Figma 653:73 (19×14) ──────────────────────────────────────
export function CloudIcon({ color, size = 19 }: IconProps) {
  const h = (14 / 19) * size;
  return (
    <Svg width={size} height={h} viewBox="0 0 19 14" fill="none">
      {/* Puffy cloud: big centre lobe, small left lobe, flat bottom */}
      <Path
        d="M4.9 13.25
           H13.7
           C15.9 13.25 17.7 11.5 17.7 9.3
           C17.7 7.4 16.4 5.85 14.6 5.45
           C14.1 3 11.95 1.15 9.35 1.15
           C6.85 1.15 4.75 2.9 4.2 5.25
           C2.5 5.55 1.25 7.05 1.25 8.85
           C1.25 11.3 2.85 13.25 4.9 13.25 Z"
        stroke={color} strokeWidth={1.5} strokeLinejoin="round"
      />
    </Svg>
  );
}
