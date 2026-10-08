import { useId } from "react";
import { RotateCcw } from "lucide-react";
import {
  PROFILE_TAG_COLORS,
  PROFILE_TAG_SYMBOLS,
  PROFILE_TAG_TEXT_LIMIT,
} from "@shared/profile-tag";

interface ProfileTagEditorProps {
  value: { tagSymbol: string; tagText: string; tagColor: string };
  onChange: (nextValue: {
    tagSymbol: string;
    tagText: string;
    tagColor: string;
  }) => void;
}

export function ProfileTagEditor({ value, onChange }: ProfileTagEditorProps) {
  const id = useId();
  const firstSymbol = PROFILE_TAG_SYMBOLS[0];
  const firstColor = PROFILE_TAG_COLORS[0];

  const update = (changes: Partial<ProfileTagEditorProps["value"]>) => {
    onChange({ ...value, ...changes });
  };

  const clearTag = () => {
    onChange({ tagSymbol: firstSymbol, tagText: "", tagColor: firstColor });
  };

  return (
    <section className="space-y-4 rounded-lg border border-primary/25 bg-[#171923] p-4 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-[11px] font-semibold tracking-[0.16em] text-primary">
            PROFILE TAG
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            A small signal that follows you through conversation.
          </p>
        </div>
        <button
          type="button"
          onClick={clearTag}
          aria-label="Clear profile tag and reset symbol and color"
          className="inline-flex shrink-0 items-center gap-1.5 rounded border border-white/10 px-2 py-1.5 font-mono text-[9px] tracking-wider text-white/55 transition-colors hover:border-accent/50 hover:bg-accent/5 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <RotateCcw aria-hidden="true" className="h-3 w-3" />
          CLEAR
        </button>
      </div>

      <fieldset className="space-y-2">
        <legend className="font-mono text-[9px] tracking-[0.14em] text-white/50">
          01 / CHOOSE A MARK
        </legend>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
          {PROFILE_TAG_SYMBOLS.map((symbol) => {
            const selected = value.tagSymbol === symbol;
            return (
              <button
                key={symbol}
                type="button"
                onClick={() => update({ tagSymbol: symbol })}
                aria-label={`Use ${symbol} as profile tag symbol`}
                aria-pressed={selected}
                className={`flex h-9 min-w-0 items-center justify-center rounded border text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  selected
                    ? "border-primary bg-primary/15 text-primary shadow-[inset_0_0_0_1px_rgba(167,139,250,0.16)]"
                    : "border-white/10 bg-black/20 text-white/65 hover:border-primary/50 hover:bg-primary/5 hover:text-white"
                }`}
              >
                {symbol}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-2">
        <label
          htmlFor={`${id}-text`}
          className="block font-mono text-[9px] tracking-[0.14em] text-white/50"
        >
          02 / TAG TEXT
        </label>
        <div className="relative">
          <input
            id={`${id}-text`}
            type="text"
            value={value.tagText}
            onChange={(event) =>
              update({
                tagText: event.target.value
                  .toUpperCase()
                  .slice(0, PROFILE_TAG_TEXT_LIMIT),
              })
            }
            maxLength={PROFILE_TAG_TEXT_LIMIT}
            placeholder="YOUR SIGNAL"
            autoComplete="off"
            className="w-full rounded border border-white/10 bg-[#101118] px-3 py-2.5 pr-16 font-mono text-xs tracking-[0.12em] text-white placeholder:text-white/25 focus:border-primary/70 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <span
            aria-live="polite"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] tabular-nums text-white/35"
          >
            {value.tagText.length}/{PROFILE_TAG_TEXT_LIMIT}
          </span>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="font-mono text-[9px] tracking-[0.14em] text-white/50">
          03 / TAG COLOR
        </legend>
        <div className="flex flex-wrap gap-2">
          {PROFILE_TAG_COLORS.map((color, index) => {
            const selected = value.tagColor.toUpperCase() === color.toUpperCase();
            return (
              <button
                key={color}
                type="button"
                onClick={() => update({ tagColor: color })}
                aria-label={`Select tag color ${color}`}
                aria-pressed={selected}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#171923] ${
                  selected ? "ring-2 ring-white ring-offset-2 ring-offset-[#171923]" : ""
                }`}
                style={{ backgroundColor: color }}
                data-color-index={index}
              >
                {selected && (
                  <span className="h-2 w-2 rounded-full border border-black/60 bg-white/90" />
                )}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div
        aria-label="Profile tag preview"
        aria-live="polite"
        className="flex items-center justify-between gap-4 rounded-md border border-white/[0.07] bg-[#101118] px-3 py-2.5"
      >
        <div>
          <div className="font-mono text-[8px] tracking-[0.16em] text-white/35">
            LIVE PREVIEW
          </div>
          <div className="mt-1 text-[9px] text-white/45">
            How your tag appears in chat
          </div>
        </div>
        <span
          className="inline-flex max-w-[65%] items-center gap-1.5 truncate rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.1em]"
          style={{
            color: value.tagColor,
            borderColor: `${value.tagColor}70`,
            backgroundColor: `${value.tagColor}14`,
          }}
        >
          <span aria-hidden="true">{value.tagSymbol}</span>
          {value.tagText ? (
            <span className="truncate">{value.tagText}</span>
          ) : (
            <span className="text-white/35">TAG TEXT</span>
          )}
        </span>
      </div>
    </section>
  );
}
