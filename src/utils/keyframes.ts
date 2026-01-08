import type {
  Keyframe,
  KeyframeValue,
  EasingType,
  CubicBezier,
  PositionValue,
} from "@/schemas/keyframe.schema";
import { PROPERTY_DEFAULTS } from "@/schemas/keyframe.schema";
import type { Clip } from "@/schemas";

// ============================================================================
// Easing Functions
// ============================================================================

/**
 * Standard easing functions
 * Takes a progress value from 0 to 1 and returns the eased value
 */
export const easingFunctions: Record<
  Exclude<EasingType, "cubic-bezier">,
  (t: number) => number
> = {
  linear: (t) => t,
  "ease-in": (t) => t * t * t,
  "ease-out": (t) => 1 - Math.pow(1 - t, 3),
  "ease-in-out": (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

/**
 * Calculate cubic bezier value using De Casteljau's algorithm
 */
export function cubicBezier(t: number, bezier: CubicBezier): number {
  const { x1, y1, x2, y2 } = bezier;

  // Binary search to find t for x coordinate
  let low = 0;
  let high = 1;
  let mid: number;

  for (let i = 0; i < 20; i++) {
    mid = (low + high) / 2;
    const x = bezierPoint(mid, 0, x1, x2, 1);
    if (Math.abs(x - t) < 0.001) break;
    if (x < t) low = mid;
    else high = mid;
  }

  // Calculate y value at the found t
  return bezierPoint(mid!, 0, y1, y2, 1);
}

/**
 * Calculate a point on a cubic bezier curve
 */
function bezierPoint(
  t: number,
  p0: number,
  p1: number,
  p2: number,
  p3: number
): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/**
 * Get the eased progress value
 */
export function getEasedProgress(
  progress: number,
  easing: EasingType,
  bezier?: CubicBezier
): number {
  if (easing === "cubic-bezier" && bezier) {
    return cubicBezier(progress, bezier);
  }
  return easingFunctions[easing as Exclude<EasingType, "cubic-bezier">](
    progress
  );
}

// ============================================================================
// Interpolation Functions
// ============================================================================

/**
 * Interpolate a numeric value between two values
 */
export function interpolateNumber(
  from: number,
  to: number,
  progress: number,
  easing: EasingType,
  bezier?: CubicBezier
): number {
  const easedProgress = getEasedProgress(progress, easing, bezier);
  return from + (to - from) * easedProgress;
}

/**
 * Parse hex color to RGB components
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to hex string
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Interpolate a color value (hex string)
 */
export function interpolateColor(
  from: string,
  to: string,
  progress: number,
  easing: EasingType,
  bezier?: CubicBezier
): string {
  const easedProgress = getEasedProgress(progress, easing, bezier);
  const fromRgb = hexToRgb(from);
  const toRgb = hexToRgb(to);

  return rgbToHex(
    fromRgb.r + (toRgb.r - fromRgb.r) * easedProgress,
    fromRgb.g + (toRgb.g - fromRgb.g) * easedProgress,
    fromRgb.b + (toRgb.b - fromRgb.b) * easedProgress
  );
}

/**
 * Interpolate a position value
 */
export function interpolatePosition(
  from: PositionValue,
  to: PositionValue,
  progress: number,
  easing: EasingType,
  bezier?: CubicBezier
): PositionValue {
  return {
    x: interpolateNumber(from.x, to.x, progress, easing, bezier),
    y: interpolateNumber(from.y, to.y, progress, easing, bezier),
  };
}

/**
 * Interpolate any keyframe value based on type
 */
export function interpolateValue(
  from: KeyframeValue,
  to: KeyframeValue,
  progress: number,
  easing: EasingType,
  bezier?: CubicBezier
): KeyframeValue {
  // Number interpolation
  if (typeof from === "number" && typeof to === "number") {
    return interpolateNumber(from, to, progress, easing, bezier);
  }

  // Color interpolation (strings starting with #)
  if (typeof from === "string" && typeof to === "string") {
    return interpolateColor(from, to, progress, easing, bezier);
  }

  // Position interpolation (objects with x, y)
  if (
    typeof from === "object" &&
    typeof to === "object" &&
    "x" in from &&
    "x" in to
  ) {
    return interpolatePosition(
      from as PositionValue,
      to as PositionValue,
      progress,
      easing,
      bezier
    );
  }

  // Fallback: return the "from" value
  return from;
}

// ============================================================================
// Core Keyframe Functions
// ============================================================================

/**
 * Get all keyframes for a specific property, sorted by time
 */
export function getKeyframesForProperty(
  keyframes: Keyframe[],
  property: string
): Keyframe[] {
  return keyframes
    .filter((kf) => kf.property === property)
    .sort((a, b) => a.time - b.time);
}

/**
 * Get the interpolated value of a property at a given time
 * This is the main function used by preview and export
 *
 * @param keyframes - All keyframes for a clip
 * @param property - The property to get (e.g., "opacity", "position")
 * @param time - Time relative to clip start (0 = clip start)
 * @param defaultValue - Default value if no keyframes exist
 */
export function getPropertyAtTime<T extends KeyframeValue>(
  keyframes: Keyframe[],
  property: string,
  time: number,
  defaultValue: T
): T {
  const propertyKeyframes = getKeyframesForProperty(keyframes, property);

  // No keyframes: return default
  if (propertyKeyframes.length === 0) {
    return defaultValue;
  }

  // Before first keyframe: use first keyframe value
  if (time <= propertyKeyframes[0].time) {
    return propertyKeyframes[0].value as T;
  }

  // After last keyframe: use last keyframe value
  const lastKf = propertyKeyframes[propertyKeyframes.length - 1];
  if (time >= lastKf.time) {
    return lastKf.value as T;
  }

  // Find surrounding keyframes
  let prevKf = propertyKeyframes[0];
  let nextKf = propertyKeyframes[1];

  for (let i = 0; i < propertyKeyframes.length - 1; i++) {
    if (
      time >= propertyKeyframes[i].time &&
      time < propertyKeyframes[i + 1].time
    ) {
      prevKf = propertyKeyframes[i];
      nextKf = propertyKeyframes[i + 1];
      break;
    }
  }

  // Calculate progress between keyframes
  const progress = (time - prevKf.time) / (nextKf.time - prevKf.time);

  // Interpolate using the previous keyframe's easing
  return interpolateValue(
    prevKf.value,
    nextKf.value,
    progress,
    prevKf.easing,
    prevKf.bezier
  ) as T;
}

// ============================================================================
// Clip-Level Functions
// ============================================================================

/**
 * Get default value for a property based on clip type
 */
export function getDefaultForProperty(
  clip: Clip,
  property: string
): KeyframeValue {
  // Check if clip has the property as a direct field
  switch (property) {
    case "volume":
      if ("volume" in clip) return clip.volume;
      break;
    case "position":
      if ("position" in clip) return clip.position;
      break;
    case "fontSize":
      if ("fontSize" in clip) return clip.fontSize;
      break;
    case "color":
      if ("color" in clip) return clip.color;
      break;
    case "scale":
      if ("scale" in clip) return clip.scale;
      break;
    case "rotation":
      if ("rotation" in clip) return clip.rotation;
      break;
    case "opacity":
      if ("opacity" in clip) return clip.opacity;
      break;
  }

  // Fall back to global defaults
  return PROPERTY_DEFAULTS[property] ?? 1;
}

/**
 * Animated property result with computed values
 */
export interface AnimatedProperties {
  opacity: number;
  scale: number;
  rotation: number;
  position: PositionValue;
  volume?: number;
  pan?: number;
  fontSize?: number;
  color?: string;
}

/**
 * Get all animated properties for a clip at a given absolute timeline time
 * Returns an object with all property values (animated or default)
 *
 * @param clip - The clip to get properties for
 * @param time - Absolute timeline time (not relative to clip)
 */
export function getAnimatedPropertiesAtTime(
  clip: Clip,
  time: number
): AnimatedProperties {
  const clipTime = time - clip.startTime; // Convert to clip-relative time
  const keyframes = clip.keyframes || [];

  // Base animated properties (common to all clips)
  const result: AnimatedProperties = {
    opacity: getPropertyAtTime(
      keyframes,
      "opacity",
      clipTime,
      getDefaultForProperty(clip, "opacity") as number
    ),
    scale: getPropertyAtTime(
      keyframes,
      "scale",
      clipTime,
      getDefaultForProperty(clip, "scale") as number
    ),
    rotation: getPropertyAtTime(
      keyframes,
      "rotation",
      clipTime,
      getDefaultForProperty(clip, "rotation") as number
    ),
    position: getPropertyAtTime(
      keyframes,
      "position",
      clipTime,
      getDefaultForProperty(clip, "position") as PositionValue
    ),
  };

  // Type-specific properties
  if (clip.type === "video" || clip.type === "audio") {
    result.volume = getPropertyAtTime(
      keyframes,
      "volume",
      clipTime,
      getDefaultForProperty(clip, "volume") as number
    );
  }

  if (clip.type === "audio") {
    result.pan = getPropertyAtTime(
      keyframes,
      "pan",
      clipTime,
      getDefaultForProperty(clip, "pan") as number
    );
  }

  if (clip.type === "text") {
    result.fontSize = getPropertyAtTime(
      keyframes,
      "fontSize",
      clipTime,
      getDefaultForProperty(clip, "fontSize") as number
    );
    result.color = getPropertyAtTime(
      keyframes,
      "color",
      clipTime,
      getDefaultForProperty(clip, "color") as string
    );
  }

  return result;
}

// ============================================================================
// Keyframe Query Helpers
// ============================================================================

/**
 * Check if a clip has any keyframes for a property
 */
export function hasKeyframesForProperty(
  clip: Clip,
  property: string
): boolean {
  return (clip.keyframes || []).some((kf) => kf.property === property);
}

/**
 * Get all unique properties that have keyframes in a clip
 */
export function getKeyframedProperties(clip: Clip): string[] {
  const properties = new Set<string>();
  for (const kf of clip.keyframes || []) {
    properties.add(kf.property);
  }
  return Array.from(properties);
}

/**
 * Find keyframe at a specific time (within tolerance)
 */
export function findKeyframeAtTime(
  keyframes: Keyframe[],
  property: string,
  time: number,
  tolerance: number = 0.05
): Keyframe | undefined {
  return keyframes.find(
    (kf) => kf.property === property && Math.abs(kf.time - time) <= tolerance
  );
}

/**
 * Get keyframes grouped by time (for timeline markers)
 */
export function getKeyframesByTime(
  keyframes: Keyframe[]
): Map<number, Keyframe[]> {
  const grouped = new Map<number, Keyframe[]>();

  for (const kf of keyframes) {
    // Round to 2 decimal places for grouping
    const roundedTime = Math.round(kf.time * 100) / 100;
    if (!grouped.has(roundedTime)) {
      grouped.set(roundedTime, []);
    }
    grouped.get(roundedTime)!.push(kf);
  }

  return grouped;
}
