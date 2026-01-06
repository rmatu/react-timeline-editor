// Re-export all schema types
export type {
  Clip,
  VideoClip,
  AudioClip,
  TextClip,
  StickerClip,
  ClipType,
  Track,
  TrackType,
  Timeline,
  Resolution,
} from "@/schemas";

// Gesture types
export type GestureType = "scroll" | "zoom" | "clipMove" | "trim";

export interface GestureState {
  active: GestureType | null;
  startPosition: { x: number; y: number } | null;
}

// Selection types
export interface SelectionState {
  selectedClipIds: string[];
  selectedTrackId: string | null;
  selectionBox: SelectionBox | null;
}

export interface SelectionBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

// Playback types
export interface PlaybackState {
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  loop: boolean;
  loopStart: number | null;
  loopEnd: number | null;
}

// Viewport types
export interface ViewportState {
  scrollX: number;
  scrollY: number;
  zoomLevel: number; // Pixels per second
  width: number;
  height: number;
}

// Snap types
export type SnapPointType =
  | "clip-start"
  | "clip-end"
  | "playhead"
  | "timeline-start"
  | "timeline-end";

export interface SnapPoint {
  time: number;
  type: SnapPointType;
  sourceId?: string;
}

export interface SnapResult {
  snapped: boolean;
  snapPoint: SnapPoint | null;
  snappedTime: number;
}

// Trim types
export type TrimSide = "left" | "right";

export interface TrimState {
  clipId: string;
  side: TrimSide;
  initialStartTime: number;
  initialDuration: number;
  initialSourceStartTime: number;
}

// Drag types
export interface DragState {
  clipId: string;
  initialStartTime: number;
  initialTrackId: string;
  offsetX: number;
}

// History types for undo/redo
export interface HistoryEntry {
  clips: Map<string, Clip>;
  tracks: Map<string, Track>;
  timestamp: number;
}

// Time ruler types
export interface RulerInterval {
  interval: number; // Seconds between major marks
  subdivisions: number; // Number of minor marks between major marks
  format: "seconds" | "minutes";
}

// Keyboard shortcut handler
export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

// Component prop types
export interface TimelineProps {
  currentTime: number;
  isPlaying: boolean;
  onTimeChange: (time: number) => void;
  onPlayPause: () => void;
  className?: string;
}

export interface VideoPreviewProps {
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  className?: string;
}

export interface TrackProps {
  trackId: string;
  zoomLevel: number;
  scrollX: number;
}

export interface ClipProps {
  clipId: string;
  zoomLevel: number;
  isSelected: boolean;
  onSelect: (clipId: string, multi: boolean) => void;
}

export interface TrimHandleProps {
  clipId: string;
  side: TrimSide;
  canExtend: boolean;
}

// Utility types
export type TimeRange = {
  start: number;
  end: number;
};

export type Position = {
  x: number;
  y: number;
};

// Import Clip type for the map
import type { Clip, Track } from "@/schemas";
