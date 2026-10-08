export const PROFILE_TAG_SYMBOLS = [
  "★",
  "✦",
  "✧",
  "◆",
  "◇",
  "●",
  "▲",
  "■",
  "♠",
  "♣",
  "∞",
  "§",
] as const;

export const PROFILE_TAG_COLORS = [
  "#A78BFA",
  "#22D3EE",
  "#34D399",
  "#FACC15",
  "#FB7185",
  "#F87171",
  "#60A5FA",
  "#C084FC",
  "#F472B6",
  "#F97316",
  "#A3E635",
  "#F8FAFC",
] as const;

export const PROFILE_TAG_TEXT_LIMIT = 20;

export type ProfileTagSymbol = (typeof PROFILE_TAG_SYMBOLS)[number];
export type ProfileTagColor = (typeof PROFILE_TAG_COLORS)[number];

export function normalizeProfileTagText(value: string) {
  return value.trim().toUpperCase().slice(0, PROFILE_TAG_TEXT_LIMIT);
}

export function isProfileTagSymbol(value: unknown): value is ProfileTagSymbol {
  return (
    typeof value === "string" &&
    (PROFILE_TAG_SYMBOLS as readonly string[]).includes(value)
  );
}

export function isProfileTagColor(value: unknown): value is ProfileTagColor {
  return (
    typeof value === "string" &&
    (PROFILE_TAG_COLORS as readonly string[]).includes(value)
  );
}
