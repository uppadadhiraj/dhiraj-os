/**
 * Small top-to-bottom architecture diagram. Each row is a layer; nodes in a row are
 * parallel. A node string may be "Title | subtitle". Pure markup (no client JS), with a
 * sentence-form text alternative for screen readers.
 */
function parseNode(n: string): { title: string; sub?: string } {
  const [title, ...rest] = n.split(" | ");
  return { title: title.trim(), sub: rest.join(" | ").trim() || undefined };
}

const Arrow = () => (
  <svg width="16" height="20" viewBox="0 0 16 20" shapeRendering="crispEdges" aria-hidden="true" focusable="false" className="text-[var(--c-navy-2)]">
    <path fill="currentColor" d="M7 0h2v12h3v2h-2v2H9v2H7v-2H5v-2H4v-2h3z" />
  </svg>
);

export function ArchitectureDiagram({ rows, label }: { rows: string[][]; label: string }) {
  const summary = rows.map((r) => r.map((n) => parseNode(n).title).join(" and ")).join(", then ");
  return (
    <figure className="m-0" aria-label={label}>
      <div className="flex flex-col items-center gap-0" aria-hidden="true">
        {rows.map((row, i) => (
          <div key={i} className="flex w-full flex-col items-center">
            <div className="flex w-full flex-wrap justify-center gap-2">
              {row.map((n) => {
                const { title, sub } = parseNode(n);
                return (
                  <div
                    key={n}
                    className="bevel-out min-w-[150px] max-w-[300px] flex-1 px-3 py-2 text-center"
                    style={{ flexBasis: row.length === 1 ? "min(100%, 420px)" : 0, flexGrow: row.length === 1 ? 0 : 1 }}
                  >
                    <p className="m-0 font-[family-name:var(--font-pixel)] text-[14.5px] leading-tight text-[var(--c-ink)]">{title}</p>
                    {sub ? <p className="m-0 mt-0.5 text-[12px] leading-snug text-[var(--c-ink-2)]">{sub}</p> : null}
                  </div>
                );
              })}
            </div>
            {i < rows.length - 1 ? (
              <div className="py-1">
                <Arrow />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <figcaption className="sr-only">Data flows top to bottom: {summary}.</figcaption>
    </figure>
  );
}
