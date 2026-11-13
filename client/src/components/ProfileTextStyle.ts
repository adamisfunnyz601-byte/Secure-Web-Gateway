import type { CSSProperties } from "react";

export const USERNAME_FONTS: {
  id: string;
  label: string;
  className: string;
}[] = [
  { id: "default", label: "DEFAULT", className: "font-mono" },
  {
    id: "neon",
    label: "NEON",
    className:
      "font-mono text-primary drop-shadow-[0_0_6px_rgba(34,197,94,0.9)]",
  },
  {
    id: "matrix",
    label: "MATRIX",
    className: "font-mono text-green-400 tracking-widest",
  },
  {
    id: "cyber",
    label: "CYBER",
    className: "font-['Orbitron'] tracking-wider",
  },
  {
    id: "glitch",
    label: "GLITCH",
    className:
      "font-mono italic text-fuchsia-400 drop-shadow-[0_0_4px_rgba(217,70,239,0.8)]",
  },
  {
    id: "fire",
    label: "FIRE",
    className:
      "font-mono font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent",
  },
  {
    id: "ice",
    label: "ICE",
    className:
      "font-mono font-bold bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-transparent",
  },
  {
    id: "rainbow",
    label: "RAINBOW",
    className:
      "font-mono font-bold bg-gradient-to-r from-pink-500 via-yellow-400 to-cyan-400 bg-clip-text text-transparent",
  },
  { id: "comic-sans", label: "COMIC SANS", className: "font-comic-sans italic" },
  { id: "ghost", label: "GHOST", className: "font-mono text-white/40" },
  {
    id: "elite",
    label: "ELITE",
    className:
      "font-['Orbitron'] font-black uppercase text-primary tracking-widest",
  },
];

export function getFontClass(id?: string | null) {
  if (id?.startsWith("custom-gradient|")) id = id.split("|")[1] || "default";
  if (id?.startsWith("custom-font|")) return USERNAME_FONTS[0].className;
  return USERNAME_FONTS.find((f) => f.id === id)?.className || USERNAME_FONTS[0].className;
}



export function getFontClass(id?: string | null) {
  if (id?.startsWith("custom-gradient|")) id = id.split("|")[1] || "default";
  if (id?.startsWith("custom-font|")) return USERNAME_FONTS[0].className;
  return USERNAME_FONTS.find((f) => f.id === id)?.className || USERNAME_FONTS[0].className;
}

export function getUsernameGradientStyle(value?: string | null): CSSProperties {
  if (!value?.startsWith("custom-gradient|") && !value?.startsWith("custom-font|")) return {};
  const parts = value.split("|");
  const isUploadedFont = parts[0] === "custom-font";
  const font = isUploadedFont ? "default" : parts[1];
  const a = parts[2];
  const b = parts[3];
  const d = parts[4] || b;
  if (!/^[a-z-]+$/.test(font || "")) return {};
  if (isUploadedFont && parts.length === 2) return {};
  if (!/^#[0-9a-f]{6}$/i.test(a || "") || !/^#[0-9a-f]{6}$/i.test(b || "") || !/^#[0-9a-f]{6}$/i.test(d || "")) return {};
  return { backgroundImage:`linear-gradient(100deg,${a},${b},${d},${a})`, backgroundSize:"250% 250%", animation:"profileTextGradientFlow 7s ease infinite", backgroundClip:"text", WebkitBackgroundClip:"text", color:"transparent" };
}
