import {
  PROFILE_TAG_COLORS,
  PROFILE_TAG_SYMBOLS,
} from "@shared/profile-tag";
import { cn } from "@/lib/utils";

type UserProfileTagProps = {
  tagSymbol?: string | null;
  tagText?: string | null;
  tagColor?: string | null;
  size?: "compact" | "default";
};

export function UserProfileTag({
  tagSymbol,
  tagText,
  tagColor,
  size = "default",
}: UserProfileTagProps) {
  const text = tagText?.trim().toUpperCase();
  if (!text) return null;

  const symbol = (PROFILE_TAG_SYMBOLS as readonly string[]).includes(tagSymbol || "")
    ? tagSymbol!
    : PROFILE_TAG_SYMBOLS[0];
  const color = (PROFILE_TAG_COLORS as readonly string[]).includes(tagColor || "")
    ? tagColor!
    : PROFILE_TAG_COLORS[0];

  return (
    <span
      aria-label={`${symbol} ${text}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border font-mono font-semibold leading-none tracking-[0.08em]",
        size === "compact" ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-1 text-[9px]",
      )}
      style={{
        color,
        borderColor: `${color}70`,
        backgroundColor: `${color}16`,
      }}
      data-testid="user-profile-tag"
    >
      <span aria-hidden="true">{symbol}</span>
      <span className="truncate">{text}</span>
    </span>
  );
}
