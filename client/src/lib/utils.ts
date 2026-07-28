import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Deterministically derive a visually distinct OKLCH color pair (bg + text)
 * from a project id or name string. Uses a fixed palette of 10 hues that
 * look good at low chroma on both light and dark backgrounds.
 */
export function getProjectColor(seed: string | number): { bg: string; text: string } {
  const HUES = [25, 55, 145, 200, 250, 270, 300, 340, 180, 80];
  let hash = 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  const hue = HUES[hash % HUES.length];
  return {
    bg: `oklch(0.55 0.20 ${hue} / 0.12)`,
    text: `oklch(0.42 0.18 ${hue})`,
  };
}
