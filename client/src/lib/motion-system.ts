import type { Transition, Variants } from "framer-motion";

/**
 * Reusable motion vocabulary for the NEXUS interface.
 * Presets are composable: entry × duration × distance × direction × easing
 * produces thousands of useful variations without shipping thousands of components.
 */
export type MotionEntry = "fade" | "rise" | "drop" | "slide" | "scale" | "soft-pop" | "blur" | "tilt";
export type MotionSpeed = "instant" | "fast" | "normal" | "relaxed";
export type MotionDirection = "up" | "down" | "left" | "right";

const speeds: Record<MotionSpeed, number> = {
  instant: 0.12,
  fast: 0.18,
  normal: 0.26,
  relaxed: 0.42,
};

const distances: Record<MotionDirection, { x: number; y: number }> = {
  up: { x: 0, y: 12 },
  down: { x: 0, y: -12 },
  left: { x: 12, y: 0 },
  right: { x: -12, y: 0 },
};

export function createMotionPreset(
  entry: MotionEntry = "rise",
  speed: MotionSpeed = "normal",
  direction: MotionDirection = "up",
  intensity = 1,
): { variants: Variants; transition: Transition } {
  const offset = distances[direction];
  const distance = Math.max(0, Math.min(2, intensity));
  const hidden: Record<string, any> = { opacity: 0 };
  const shown: Record<string, unknown> = { opacity: 1 };

  if (entry === "rise" || entry === "drop" || entry === "slide") {
    hidden.x = entry === "slide" ? offset.x * distance : 0;
    hidden.y = entry === "rise" ? 14 * distance : entry === "drop" ? -14 * distance : offset.y * distance;
    shown.x = 0; shown.y = 0;
  } else if (entry === "scale" || entry === "soft-pop") {
    hidden.scale = entry === "soft-pop" ? 0.96 : 0.94;
    shown.scale = 1;
  } else if (entry === "blur") {
    hidden.filter = "blur(8px)";
    shown.filter = "blur(0px)";
  } else if (entry === "tilt") {
    hidden.rotate = direction === "left" ? -2 * distance : 2 * distance;
    hidden.y = 8 * distance;
    shown.rotate = 0; shown.y = 0;
  }

  return {
    variants: { hidden, visible: shown, exit: { ...hidden, transition: { duration: speeds[speed] * 0.7 } } },
    transition: { duration: speeds[speed], ease: [0.2, 0.8, 0.2, 1] },
  };
}

export const motionPresets = {
  page: createMotionPreset("rise", "normal", "up", 0.8),
  panel: createMotionPreset("soft-pop", "fast"),
  modal: createMotionPreset("scale", "normal"),
  toast: createMotionPreset("slide", "fast", "right"),
  listItem: createMotionPreset("fade", "fast"),
  celebration: createMotionPreset("tilt", "relaxed"),
} as const;

export const interactionMotion = {
  button: { whileHover: { y: -1, scale: 1.015 }, whileTap: { scale: 0.975 } },
  card: { whileHover: { y: -3, transition: { duration: 0.18 } } },
  icon: { whileHover: { rotate: 5, scale: 1.08 }, whileTap: { scale: 0.9 } },
} as const;
