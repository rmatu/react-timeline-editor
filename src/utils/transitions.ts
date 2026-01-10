/**
 * Transition Utilities
 *
 * Functions for calculating and applying visual transitions between clips.
 * Used by both preview rendering and export engine for WYSIWYG output.
 */

import type { Clip, TransitionType } from "@/schemas";
import { getEasedProgress } from "./keyframes";

// ============================================================================
// Types
// ============================================================================

export interface TransitionState {
  isActive: boolean;
  progress: number; // 0-1, eased
  rawProgress: number; // 0-1, linear
  type: TransitionType;
  side: "in" | "out";
}

export interface TransitionTransform {
  opacity: number;
  translateX: number; // percentage
  translateY: number; // percentage
  scale: number;
  clipPath?: string; // CSS clip-path value
}

// ============================================================================
// Transition Detection
// ============================================================================

/**
 * Check if clip is currently in a transition zone and return transition state
 */
export function getTransitionState(
  clip: Clip,
  currentTime: number
): TransitionState | null {
  const clipStart = clip.startTime;
  const clipEnd = clip.startTime + clip.duration;
  const timeInClip = currentTime - clipStart;

  // Check transition in (at clip start)
  if (clip.transitionIn && timeInClip >= 0) {
    const transitionEnd = clip.transitionIn.duration;
    if (timeInClip < transitionEnd) {
      const rawProgress = timeInClip / transitionEnd;
      const easedProgress = getEasedProgress(
        rawProgress,
        clip.transitionIn.easing,
        clip.transitionIn.bezier
      );
      return {
        isActive: true,
        progress: easedProgress,
        rawProgress,
        type: clip.transitionIn.type,
        side: "in",
      };
    }
  }

  // Check transition out (at clip end)
  if (clip.transitionOut && currentTime < clipEnd) {
    const transitionStart = clipEnd - clip.transitionOut.duration;
    if (currentTime >= transitionStart) {
      const timeInTransition = currentTime - transitionStart;
      const rawProgress = timeInTransition / clip.transitionOut.duration;
      const easedProgress = getEasedProgress(
        rawProgress,
        clip.transitionOut.easing,
        clip.transitionOut.bezier
      );
      return {
        isActive: true,
        progress: easedProgress,
        rawProgress,
        type: clip.transitionOut.type,
        side: "out",
      };
    }
  }

  return null;
}

/**
 * Check if current time is within any transition of the clip
 */
export function isInTransition(clip: Clip, currentTime: number): boolean {
  return getTransitionState(clip, currentTime) !== null;
}

/**
 * Get the effective duration of a clip excluding transition zones
 * (useful for calculating available space for content)
 */
export function getEffectiveClipDuration(clip: Clip): number {
  const transitionInDuration = clip.transitionIn?.duration ?? 0;
  const transitionOutDuration = clip.transitionOut?.duration ?? 0;
  return Math.max(0, clip.duration - transitionInDuration - transitionOutDuration);
}

// ============================================================================
// Transform Calculation
// ============================================================================

/**
 * Calculate transform values for a transition
 * Progress goes from 0 (start) to 1 (end)
 * For "in" transitions: 0 = invisible, 1 = fully visible
 * For "out" transitions: 0 = fully visible, 1 = invisible
 */
export function getTransitionTransform(
  type: TransitionType,
  progress: number,
  side: "in" | "out"
): TransitionTransform {
  // For "out" transitions, invert the progress
  const p = side === "out" ? 1 - progress : progress;

  switch (type) {
    // Opacity transitions
    case "fade":
    case "dissolve":
      return {
        opacity: p,
        translateX: 0,
        translateY: 0,
        scale: 1,
      };

    // Slide transitions
    case "slide-left":
      return {
        opacity: 1,
        translateX: (1 - p) * -100, // Slides in from left
        translateY: 0,
        scale: 1,
      };

    case "slide-right":
      return {
        opacity: 1,
        translateX: (1 - p) * 100, // Slides in from right
        translateY: 0,
        scale: 1,
      };

    case "slide-up":
      return {
        opacity: 1,
        translateX: 0,
        translateY: (1 - p) * -100, // Slides in from top
        scale: 1,
      };

    case "slide-down":
      return {
        opacity: 1,
        translateX: 0,
        translateY: (1 - p) * 100, // Slides in from bottom
        scale: 1,
      };

    // Wipe transitions (use clip-path)
    case "wipe-left":
      return {
        opacity: 1,
        translateX: 0,
        translateY: 0,
        scale: 1,
        clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`, // Reveals from left
      };

    case "wipe-right":
      return {
        opacity: 1,
        translateX: 0,
        translateY: 0,
        scale: 1,
        clipPath: `inset(0 0 0 ${(1 - p) * 100}%)`, // Reveals from right
      };

    case "wipe-up":
      return {
        opacity: 1,
        translateX: 0,
        translateY: 0,
        scale: 1,
        clipPath: `inset(0 0 ${(1 - p) * 100}% 0)`, // Reveals from top
      };

    case "wipe-down":
      return {
        opacity: 1,
        translateX: 0,
        translateY: 0,
        scale: 1,
        clipPath: `inset(${(1 - p) * 100}% 0 0 0)`, // Reveals from bottom
      };

    // Zoom transitions
    case "zoom-in":
      return {
        opacity: p,
        translateX: 0,
        translateY: 0,
        scale: 0.5 + p * 0.5, // 0.5 -> 1
      };

    case "zoom-out":
      return {
        opacity: p,
        translateX: 0,
        translateY: 0,
        scale: 1.5 - p * 0.5, // 1.5 -> 1
      };

    // Push transitions (both clips move together)
    // Push transitions (both clips move together)
    case "push-left":
      return {
        opacity: 1,
        // In: Right (+100) -> Center (0)
        // Out: Center (0) -> Left (-100)
        translateX: side === "in" ? (1 - p) * 100 : -(1 - p) * 100, // Corrected from -p * 100
        translateY: 0,
        scale: 1,
      };

    case "push-right":
      return {
        opacity: 1,
        // In: Left (-100) -> Center (0)
        // Out: Center (0) -> Right (+100)
        translateX: side === "in" ? (1 - p) * -100 : (1 - p) * 100, // Corrected from p * 100
        translateY: 0,
        scale: 1,
      };

    case "push-up":
      return {
        opacity: 1,
        translateX: 0,
        // In: Bottom (+100) -> Center (0)
        // Out: Center (0) -> Top (-100)
        translateY: side === "in" ? (1 - p) * 100 : -(1 - p) * 100, // Corrected from -p * 100
        scale: 1,
      };

    case "push-down":
      return {
        opacity: 1,
        translateX: 0,
        // In: Top (-100) -> Center (0)
        // Out: Center (0) -> Bottom (+100)
        translateY: side === "in" ? (1 - p) * -100 : (1 - p) * 100, // Corrected from p * 100
        scale: 1,
      };

    default:
      return {
        opacity: 1,
        translateX: 0,
        translateY: 0,
        scale: 1,
      };
  }
}

// ============================================================================
// Canvas Rendering Helpers
// ============================================================================

/**
 * Apply transition transform to a canvas context
 * Returns cleanup function to restore context state
 */
export function applyTransitionToContext(
  ctx: CanvasRenderingContext2D,
  transform: TransitionTransform,
  canvasWidth: number,
  canvasHeight: number
): () => void {
  ctx.save();

  // Apply opacity
  ctx.globalAlpha *= transform.opacity;

  // Apply translation (percentage to pixels)
  const translateX = (transform.translateX / 100) * canvasWidth;
  const translateY = (transform.translateY / 100) * canvasHeight;
  ctx.translate(translateX, translateY);

  // Apply scale (from center)
  if (transform.scale !== 1) {
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.scale(transform.scale, transform.scale);
    ctx.translate(-canvasWidth / 2, -canvasHeight / 2);
  }

  // Apply clip path (wipe effect)
  if (transform.clipPath) {
    applyClipPath(ctx, transform.clipPath, canvasWidth, canvasHeight);
  }

  return () => ctx.restore();
}

/**
 * Parse CSS clip-path inset() and apply to canvas context
 */
function applyClipPath(
  ctx: CanvasRenderingContext2D,
  clipPath: string,
  width: number,
  height: number
): void {
  // Parse inset(top right bottom left) - values can be percentages
  const match = clipPath.match(
    /inset\(([0-9.]+)%?\s+([0-9.]+)%?\s+([0-9.]+)%?\s+([0-9.]+)%?\)/
  );

  if (match) {
    const top = (parseFloat(match[1]) / 100) * height;
    const right = (parseFloat(match[2]) / 100) * width;
    const bottom = (parseFloat(match[3]) / 100) * height;
    const left = (parseFloat(match[4]) / 100) * width;

    ctx.beginPath();
    ctx.rect(left, top, width - left - right, height - top - bottom);
    ctx.clip();
  }
}

// ============================================================================
// CSS Transform Helpers (for Preview)
// ============================================================================

/**
 * Convert transition transform to CSS transform string
 */
export function transitionTransformToCSS(transform: TransitionTransform): {
  transform: string;
  opacity: number;
  clipPath?: string;
} {
  const transforms: string[] = [];

  if (transform.translateX !== 0 || transform.translateY !== 0) {
    transforms.push(
      `translate(${transform.translateX}%, ${transform.translateY}%)`
    );
  }

  if (transform.scale !== 1) {
    transforms.push(`scale(${transform.scale})`);
  }

  return {
    transform: transforms.length > 0 ? transforms.join(" ") : "none",
    opacity: transform.opacity,
    clipPath: transform.clipPath,
  };
}

// ============================================================================
// Adjacent Clip Detection
// ============================================================================

/**
 * Find clips that are adjacent to a given clip on the same track
 * Used for determining transition compatibility
 */
export function findAdjacentClips(
  clip: Clip,
  allClips: Map<string, Clip>
): { before: Clip | null; after: Clip | null } {
  const clipEnd = clip.startTime + clip.duration;
  let before: Clip | null = null;
  let after: Clip | null = null;
  let closestBeforeGap = Infinity;
  let closestAfterGap = Infinity;

  for (const [, other] of allClips) {
    if (other.id === clip.id || other.trackId !== clip.trackId) continue;

    const otherEnd = other.startTime + other.duration;

    // Check if other clip ends before this clip starts
    if (otherEnd <= clip.startTime) {
      const gap = clip.startTime - otherEnd;
      if (gap < closestBeforeGap) {
        closestBeforeGap = gap;
        before = other;
      }
    }

    // Check if other clip starts after this clip ends
    if (other.startTime >= clipEnd) {
      const gap = other.startTime - clipEnd;
      if (gap < closestAfterGap) {
        closestAfterGap = gap;
        after = other;
      }
    }
  }

  return { before, after };
}

/**
 * Calculate maximum available transition duration for a clip
 * Based on clip duration and adjacent clips
 */
export function getMaxTransitionDuration(
  clip: Clip,
  side: "in" | "out",
  allClips: Map<string, Clip>
): number {
  // Maximum is half the clip duration (so transitions don't overlap)
  const maxFromClip = clip.duration / 2;

  // Find adjacent clip
  const { before, after } = findAdjacentClips(clip, allClips);

  if (side === "in" && before) {
    // If there's a gap, transition can be up to clip duration
    // If adjacent, consider the other clip's transition out
    const gap = clip.startTime - (before.startTime + before.duration);
    if (gap <= 0) {
      // Clips are touching or overlapping
      // We only constrain to half duration to allow standard cross-dissolves behavior
      // (Even though on single track they can't cross-dissolve, we shouldn't arbitrarily limit based on neighbor)
      return maxFromClip;
    }
  }

  if (side === "out" && after) {
    const gap = after.startTime - (clip.startTime + clip.duration);
    if (gap <= 0) {
      return maxFromClip;
    }
  }

  return maxFromClip;
}
