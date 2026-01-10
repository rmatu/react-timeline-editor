import { z } from "zod";
import { EasingTypeSchema, CubicBezierSchema } from "./keyframe.schema";

// ============================================================================
// Transition Types
// ============================================================================

/**
 * Available transition effect types
 */
export const TransitionTypeSchema = z.enum([
  // Opacity transitions
  "fade",
  "dissolve",

  // Slide transitions (direction = where the clip slides FROM)
  "slide-left",
  "slide-right",
  "slide-up",
  "slide-down",

  // Wipe transitions (direction = where the wipe originates)
  "wipe-left",
  "wipe-right",
  "wipe-up",
  "wipe-down",

  // Zoom transitions
  "zoom-in",
  "zoom-out",

  // Push transitions (incoming clip pushes outgoing)
  "push-left",
  "push-right",
  "push-up",
  "push-down",
]);

/**
 * Transition configuration
 */
export const TransitionSchema = z.object({
  type: TransitionTypeSchema,
  duration: z.number().min(0.1).max(5).default(0.5), // Duration in seconds
  easing: EasingTypeSchema.default("ease-in-out"),
  bezier: CubicBezierSchema.optional(), // Only if easing === "cubic-bezier"
});

// ============================================================================
// Type Exports
// ============================================================================

export type TransitionType = z.infer<typeof TransitionTypeSchema>;
export type Transition = z.infer<typeof TransitionSchema>;

// ============================================================================
// Constants
// ============================================================================

/**
 * Available transition types for UI display
 */
export const TRANSITION_TYPES: {
  value: TransitionType;
  label: string;
  category: "opacity" | "slide" | "wipe" | "zoom" | "push";
}[] = [
  // Opacity
  { value: "fade", label: "Fade", category: "opacity" },
  { value: "dissolve", label: "Dissolve", category: "opacity" },

  // Slide
  { value: "slide-left", label: "Slide Left", category: "slide" },
  { value: "slide-right", label: "Slide Right", category: "slide" },
  { value: "slide-up", label: "Slide Up", category: "slide" },
  { value: "slide-down", label: "Slide Down", category: "slide" },

  // Wipe
  { value: "wipe-left", label: "Wipe Left", category: "wipe" },
  { value: "wipe-right", label: "Wipe Right", category: "wipe" },
  { value: "wipe-up", label: "Wipe Up", category: "wipe" },
  { value: "wipe-down", label: "Wipe Down", category: "wipe" },

  // Zoom
  { value: "zoom-in", label: "Zoom In", category: "zoom" },
  { value: "zoom-out", label: "Zoom Out", category: "zoom" },

  // Push
  { value: "push-left", label: "Push Left", category: "push" },
  { value: "push-right", label: "Push Right", category: "push" },
  { value: "push-up", label: "Push Up", category: "push" },
  { value: "push-down", label: "Push Down", category: "push" },
];

/**
 * Default transition duration in seconds
 */
export const DEFAULT_TRANSITION_DURATION = 0.5;

/**
 * Minimum transition duration in seconds
 */
export const MIN_TRANSITION_DURATION = 0.1;

/**
 * Maximum transition duration in seconds
 */
export const MAX_TRANSITION_DURATION = 5;

/**
 * Get transition by type
 */
export function getTransitionInfo(type: TransitionType) {
  return TRANSITION_TYPES.find((t) => t.value === type);
}

/**
 * Create a default transition
 */
export function createTransition(
  type: TransitionType = "fade",
  duration: number = DEFAULT_TRANSITION_DURATION
): Transition {
  return {
    type,
    duration,
    easing: "ease-in-out",
  };
}
