export type ClassValue = string | false | null | undefined;

/** Tiny className joiner — avoids a dependency for one helper. */
export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(" ");
}
