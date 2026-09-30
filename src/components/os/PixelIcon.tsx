import { ICONS, PALETTE, type IconName } from "./icon-data";

interface PixelIconProps {
  name: IconName | string;
  /** rendered size in CSS pixels; integer multiples of 16 stay perfectly crisp */
  size?: number;
  className?: string;
  title?: string;
}

/** Renders an original pixel icon as inline SVG (crisp edges, no image requests). */
export function PixelIcon({ name, size = 32, className, title }: PixelIconProps) {
  const rects = ICONS[name] ?? ICONS.info;
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {rects.map(([x, y, w, h, c], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={PALETTE[c] ?? "#f0f"} />
      ))}
    </svg>
  );
}
