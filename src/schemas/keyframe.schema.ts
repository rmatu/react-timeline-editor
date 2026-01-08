import { z } from "zod";

// Easing function types
export const EasingTypeSchema = z.enum([
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "cubic-bezier",
]);

// For cubic-bezier custom curves
export const CubicBezierSchema = z.object({
  x1: z.number().min(0).max(1),
  y1: z.number(),
  x2: z.number().min(0).max(1),
  y2: z.number(),
});

// Position value type
export const PositionValueSchema = z.object({
  x: z.number(),
  y: z.number(),
});

// Keyframe value can be different types
export const KeyframeValueSchema = z.union([
  z.number(), // opacity, scale, rotation, fontSize, volume
  z.string(), // color (hex)
  PositionValueSchema, // position
]);

// Single keyframe
export const KeyframeSchema = z.object({
  id: z.string().uuid(),
  property: z.string(), // "opacity", "position", "scale", etc.
  time: z.number().min(0), // Time relative to clip start (0 = clip start)
  value: KeyframeValueSchema,
  easing: EasingTypeSchema.default("linear"),
  bezier: CubicBezierSchema.optional(), // Only if easing === "cubic-bezier"
});

// Type exports
export type EasingType = z.infer<typeof EasingTypeSchema>;
export type CubicBezier = z.infer<typeof CubicBezierSchema>;
export type PositionValue = z.infer<typeof PositionValueSchema>;
export type KeyframeValue = z.infer<typeof KeyframeValueSchema>;
export type Keyframe = z.infer<typeof KeyframeSchema>;

// Animatable property definitions per clip type
export const ANIMATABLE_PROPERTIES = {
  // Common properties for all clips
  common: ["opacity", "scale", "rotation"] as const,

  // Type-specific animatable properties
  video: ["volume", "position"] as const,
  audio: ["volume", "pan"] as const,
  text: ["position", "fontSize", "color"] as const,
  sticker: ["position"] as const,
} as const;

// Default values for animatable properties
export const PROPERTY_DEFAULTS: Record<string, KeyframeValue> = {
  opacity: 1,
  scale: 1,
  rotation: 0,
  volume: 1,
  pan: 0,
  fontSize: 24,
  color: "#ffffff",
  position: { x: 50, y: 50 },
};

// Property metadata for UI rendering
export interface PropertyMeta {
  label: string;
  valueType: "number" | "color" | "position";
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export const PROPERTY_META: Record<string, PropertyMeta> = {
  opacity: {
    label: "Opacity",
    valueType: "number",
    min: 0,
    max: 1,
    step: 0.01,
  },
  scale: {
    label: "Scale",
    valueType: "number",
    min: 0.1,
    max: 5,
    step: 0.1,
  },
  rotation: {
    label: "Rotation",
    valueType: "number",
    min: -360,
    max: 360,
    step: 1,
    unit: "°",
  },
  volume: {
    label: "Volume",
    valueType: "number",
    min: 0,
    max: 1,
    step: 0.01,
  },
  pan: {
    label: "Pan",
    valueType: "number",
    min: -1,
    max: 1,
    step: 0.1,
  },
  fontSize: {
    label: "Font Size",
    valueType: "number",
    min: 1,
    max: 200,
    step: 1,
    unit: "px",
  },
  color: {
    label: "Color",
    valueType: "color",
  },
  position: {
    label: "Position",
    valueType: "position",
    min: 0,
    max: 100,
    step: 1,
    unit: "%",
  },
};

// Helper to get animatable properties for a clip type
export function getAnimatableProperties(
  clipType: "video" | "audio" | "text" | "sticker"
): string[] {
  const common = [...ANIMATABLE_PROPERTIES.common];
  const specific = [...ANIMATABLE_PROPERTIES[clipType]];
  return [...common, ...specific];
}
