"use client";

import { PREF_KEYS, usePref } from "@/lib/prefs";

/**
 * Desktop wallpapers — original, static SVG pixel art, purely decorative (aria-hidden).
 * Everything is built from integer arithmetic, so server and client markup always match
 * (no Math.sin / random: float results could differ by one ULP between engines).
 */
export type WallpaperId = "dusk" | "teal" | "blueprint";

export const WALLPAPERS: Array<{ id: WallpaperId; label: string }> = [
  { id: "dusk", label: "Dusk hills" },
  { id: "teal", label: "Classic teal" },
  { id: "blueprint", label: "Blueprint" },
];

const W = 1600;
const H = 900;
const CELL = 16;

/* ---------- helpers (integer only) ---------- */

/** triangle wave in [0, amp], period p, shifted by s */
const tri = (x: number, p: number, amp: number, s = 0) => {
  const t = (((x + s) % p) + p) % p;
  const half = p / 2;
  return Math.floor(((t < half ? t : p - t) * amp) / half);
};

/** y of a ridge's top edge at x: base - hills, quantised to CELL so the edge stays crisp */
function ridgeTop(x: number, base: number, a: number, b: number, c: number, s: number): number {
  const xq = Math.floor(x / CELL) * CELL;
  const h = tri(xq, 640, a, s) + tri(xq, 288, b, s * 3) + tri(xq, 112, c, s * 5);
  return Math.round((base - h) / CELL) * CELL;
}

/** a silhouette of pixel columns */
function ridge(base: number, a: number, b: number, c: number, s: number): string {
  let d = "";
  for (let x = 0; x < W; x += CELL) d += `M${x} ${ridgeTop(x, base, a, b, c, s)}h${CELL}V${H}h-${CELL}z`;
  return d;
}

/** a tiny pine tree built from stacked rects, anchored at (x, ground) */
function pine(x: number, ground: number, size: number): string {
  const u = size;
  let d = `M${x - u / 2} ${ground - u * 2}h${u}v${u * 2}h-${u}z`; // trunk is mostly hidden by foliage
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const w = u * (2 + i * 2);
    d += `M${x - w / 2} ${ground - u * (tiers * 2 - i * 2) - u * 2}h${w}v${u * 2}h-${w}z`;
  }
  return d;
}

/** stars: a fixed list (x, y, size) so nothing is computed at render time */
const STARS: Array<[number, number, number]> = [
  [80, 60, 4], [190, 140, 3], [260, 40, 3], [340, 210, 4], [430, 90, 3], [520, 30, 4], [610, 170, 3], [700, 70, 3],
  [790, 240, 4], [850, 110, 3], [930, 40, 4], [1010, 190, 3], [1090, 80, 4], [1260, 50, 3], [1330, 160, 4], [1410, 90, 3],
  [1480, 220, 3], [1550, 60, 4], [120, 290, 3], [300, 330, 3], [470, 280, 4], [640, 320, 3], [760, 360, 3], [1180, 300, 3],
  [1370, 310, 4], [1500, 350, 3], [40, 190, 3], [980, 120, 3], [1200, 230, 3], [560, 130, 3],
];
const BRIGHT = new Set([2, 7, 12, 17, 22, 26]);

const SKY: string[] = [
  "#070b24", "#0a1033", "#0e1742", "#131f55", "#1a2a6a", "#243680", "#34459a",
  "#4d5aa8", "#7a6eb0", "#b07fa8", "#de8c9a", "#f2a07f", "#fbbf80", "#ffd8a0",
];
const BAND = 44;

/** a disc made of CELL/2 blocks (the sun and its glow) */
function disc(cx: number, cy: number, r: number): string {
  const c = 8;
  let d = "";
  for (let y = -r; y < r; y += c) {
    for (let x = -r; x < r; x += c) {
      const px = x + c / 2;
      const py = y + c / 2;
      if (px * px + py * py <= r * r) d += `M${cx + x} ${cy + y}h${c}v${c}h-${c}z`;
    }
  }
  return d;
}

const CLOUDS: Array<[number, number, number]> = [
  [140, 400, 1], [520, 360, 2], [900, 420, 1], [1240, 380, 2], [1480, 440, 1],
];
function cloud(x: number, y: number, k: number): string {
  const u = 16 * k;
  return `M${x} ${y + u}h${u * 7}v${u}h-${u * 7}zM${x + u} ${y}h${u * 3}v${u}h-${u * 3}zM${x + u * 4} ${y + u / 2}h${u * 2}v${u / 2}h-${u * 2}z`;
}

const FAR = ridge(640, 70, 40, 16, 0);
const MID = ridge(720, 60, 36, 14, 200);
const NEAR = ridge(790, 46, 28, 12, 90);
const FRONT = ridge(850, 24, 16, 8, 330);
// A low sun in the middle of the picture: the top-right holds the "Now building" panel, the left holds the icons,
// and a phone shows only the middle — so this is the one spot that is clear in every layout. The hills overlap it.
const SUN = disc(800, 610, 56);
const SUN_GLOW_1 = disc(800, 610, 80);
const SUN_GLOW_2 = disc(800, 610, 112);
const PINES = [60, 150, 250, 1390, 1470, 1550].map((x) => pine(x, ridgeTop(x, 850, 24, 16, 8, 330) + 4, 6)).join("");

function Dusk() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" focusable="false" shapeRendering="crispEdges">
      {SKY.map((c, i) => (
        // the last band runs to the bottom edge so no gap shows between the sky and the hills
        <rect key={c} x="0" y={i * BAND} width={W} height={i === SKY.length - 1 ? H - i * BAND : BAND + 1} fill={c} />
      ))}
      {/* stars */}
      {STARS.map(([x, y, s], i) => (
        <rect key={i} x={x} y={y} width={s} height={s} fill={BRIGHT.has(i) ? "#ffffff" : "#bcd0ff"} opacity={BRIGHT.has(i) ? 0.95 : 0.6} />
      ))}
      {/* setting sun, drawn before the hills so the far ridge cuts across it */}
      <path d={SUN_GLOW_2} fill="#ffd8a0" opacity="0.14" />
      <path d={SUN_GLOW_1} fill="#ffe3a8" opacity="0.22" />
      <path d={SUN} fill="#fff4c4" />
      {/* clouds */}
      <g fill="#ffffff" opacity="0.14">
        {CLOUDS.map(([x, y, k]) => (
          <path key={x} d={cloud(x, y, k)} />
        ))}
      </g>
      {/* hills, far to near */}
      <path d={FAR} fill="#5b5a9e" />
      <path d={MID} fill="#413f85" />
      <path d={NEAR} fill="#2a2a66" />
      <path d={FRONT} fill="#171a45" />
      <path d={PINES} fill="#0c0f2e" />
    </svg>
  );
}

function Teal() {
  // the classic flat desktop colour, with a very faint pixel grid so it does not look empty
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" focusable="false" shapeRendering="crispEdges">
      <defs>
        <pattern id="wp-teal-grid" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M8 0H0V8" fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="#0f7f86" />
      <rect width={W} height={H} fill="url(#wp-teal-grid)" />
    </svg>
  );
}

/** engineering-paper grid and a node mesh — no code, no claims */
const NODES: Array<[number, number]> = [
  [1180, 520], [1260, 470], [1340, 530], [1420, 480], [1500, 540], [1220, 610], [1310, 620],
  [1400, 600], [1480, 650], [1560, 610], [1150, 700], [1250, 720], [1350, 730], [1450, 740],
  [1540, 720], [1300, 800], [1420, 820], [1520, 810], [1200, 810], [1100, 620],
];
const EDGES: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [1, 5], [1, 6], [2, 6], [2, 7], [3, 7], [3, 8], [4, 8],
  [4, 9], [5, 6], [6, 7], [7, 8], [8, 9], [5, 10], [5, 11], [6, 11], [6, 12], [7, 12], [7, 13],
  [8, 13], [8, 14], [9, 14], [10, 11], [11, 12], [12, 13], [13, 14], [11, 15], [12, 15], [13, 16],
  [14, 17], [15, 16], [16, 17], [10, 18], [11, 18], [0, 19], [5, 19], [10, 19],
];
const HOT = new Set([1, 6, 12, 8]);

function Blueprint() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" focusable="false">
      <defs>
        <pattern id="wp-minor" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="rgba(122,162,255,0.07)" strokeWidth="1" />
        </pattern>
        <pattern id="wp-major" width="200" height="200" patternUnits="userSpaceOnUse">
          <path d="M200 0H0V200" fill="none" stroke="rgba(122,162,255,0.13)" strokeWidth="1" />
        </pattern>
        <radialGradient id="wp-glow" cx="78%" cy="74%" r="42%">
          <stop offset="0" stopColor="#2b59d9" stopOpacity="0.22" />
          <stop offset="1" stopColor="#2b59d9" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="#0b1633" />
      <rect width={W} height={H} fill="url(#wp-minor)" />
      <rect width={W} height={H} fill="url(#wp-major)" />
      <rect width={W} height={H} fill="url(#wp-glow)" />
      <g stroke="rgba(79,143,224,0.28)" strokeWidth="1">
        {EDGES.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} />
        ))}
      </g>
      <g>
        {NODES.map(([x, y], i) => (
          <rect key={i} x={x - 4} y={y - 4} width="8" height="8" fill={HOT.has(i) ? "#ffd23f" : "#8fb4ff"} opacity={HOT.has(i) ? 0.7 : 0.5} />
        ))}
      </g>
    </svg>
  );
}

export function Wallpaper() {
  const [id] = usePref(PREF_KEYS.wallpaper, "dusk");
  const kind: WallpaperId = id === "teal" || id === "blueprint" ? id : "dusk";
  return (
    <div className="wallpaper" data-wallpaper={kind} aria-hidden="true">
      {kind === "teal" ? <Teal /> : kind === "blueprint" ? <Blueprint /> : <Dusk />}
    </div>
  );
}
