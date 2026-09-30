/**
 * The desktop wallpaper: an original, static SVG — engineering-paper grid, a node
 * mesh, a tiny architecture diagram and code fragments. Purely decorative
 * (aria-hidden); deterministic so server and client markup always match.
 */
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

const CODE_A = [
  "# retrieve → cite → answer",
  "hits = store.search(question, k=4,",
  "                    where={\"subject\": subject})",
  "if best_score < 0.35:",
  "    return \"not in the study material\"",
  "return llm.answer(context=hits, cite=True)",
];
const CODE_B = [
  "class Finding(BaseModel):",
  "    claim: str",
  "    evidence: list[EvidenceItem] = Field(min_length=1)",
  "    # NO SOURCE = NO FACT",
];
const FLOW = ["UI", "API", "AGENT", "EVIDENCE", "REPORT"];

/**
 * The faint "DHIRAJ_OS" watermark is drawn as pixel geometry (a single path) rather than text:
 * no web font to wait for, crisp at any size, and it is not a Largest-Contentful-Paint candidate.
 */
const GLYPHS: Record<string, string[]> = {
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
};
function pixelWord(word: string, x: number, y: number, cell: number): string {
  let d = "";
  [...word].forEach((ch, gi) => {
    const rows = GLYPHS[ch];
    if (!rows) return;
    rows.forEach((row, r) =>
      [...row].forEach((bit, c) => {
        if (bit === "1") d += `M${x + (gi * 6 + c) * cell} ${y + r * cell}h${cell}v${cell}h-${cell}z`;
      }),
    );
  });
  return d;
}
const WATERMARK = pixelWord("DHIRAJ_OS", 250, 730, 17);

export function Wallpaper() {
  return (
    <div className="wallpaper" aria-hidden="true">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" focusable="false">
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
        <rect width="1600" height="900" fill="url(#wp-minor)" />
        <rect width="1600" height="900" fill="url(#wp-major)" />
        <rect width="1600" height="900" fill="url(#wp-glow)" />

        {/* watermark */}
        <path d={WATERMARK} fill="rgba(143,180,255,0.07)" shapeRendering="crispEdges" />

        {/* node mesh */}
        <g stroke="rgba(79,143,224,0.28)" strokeWidth="1">
          {EDGES.map(([a, b]) => (
            <line key={`${a}-${b}`} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} />
          ))}
        </g>
        <g>
          {NODES.map(([x, y], i) => (
            <rect
              key={i}
              x={x - 4}
              y={y - 4}
              width="8"
              height="8"
              fill={HOT.has(i) ? "#ffd23f" : "#8fb4ff"}
              opacity={HOT.has(i) ? 0.7 : 0.5}
            />
          ))}
        </g>

        {/* tiny architecture diagram */}
        <g transform="translate(560 96)" fontFamily="var(--ff-mono), monospace" fontSize="11">
          {FLOW.map((label, i) => (
            <g key={label} transform={`translate(${i * 122} 0)`}>
              <rect width="100" height="34" fill="none" stroke="rgba(143,180,255,0.4)" strokeWidth="1" />
              <rect x="0" y="0" width="100" height="6" fill="rgba(143,180,255,0.18)" />
              <text x="50" y="25" textAnchor="middle" fill="rgba(180,205,255,0.6)">
                {label}
              </text>
              {i < FLOW.length - 1 && (
                <path d="M102 17h18m-5-4l5 4-5 4" fill="none" stroke="rgba(143,180,255,0.5)" strokeWidth="1.2" />
              )}
            </g>
          ))}
          <text y="64" fill="rgba(143,180,255,0.35)" style={{ fontFamily: "monospace" }}>
            agents must cite evidence · every claim links to a source
          </text>
        </g>

        {/* code fragments */}
        <g fontFamily="var(--ff-mono), monospace" fontSize="13" fill="rgba(143,170,235,0.42)">
          {CODE_A.map((line, i) => (
            <text key={i} x="300" y={250 + i * 20} xmlSpace="preserve">
              {line}
            </text>
          ))}
          {CODE_B.map((line, i) => (
            <text key={i} x="700" y={480 + i * 20} xmlSpace="preserve">
              {line}
            </text>
          ))}
        </g>
        <g fontFamily="var(--ff-mono), monospace" fontSize="12" fill="rgba(77,255,136,0.32)">
          <text x="300" y="420">$ ollama run llama3.1:8b</text>
          <text x="300" y="440">$ docker compose up -d postgres</text>
          <text x="300" y="460">$ pytest -q</text>
        </g>
      </svg>
    </div>
  );
}
