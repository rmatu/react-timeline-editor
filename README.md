# React Video Timeline

A high-performance, touch-friendly React component library for video timeline editing. Built with TypeScript, featuring multi-track support, gesture controls, and synchronized video preview.

## Features

- **Multi-track Timeline** - Support for video, audio, text, and sticker tracks
- **Clip Display** - Filename labels (not full paths) and always-visible duration badges
- **Clip Manipulation** - Drag to reposition, trim handles to adjust duration, drag timeline end handle to cut/extend timeline
- **Split & Merge** - Cut clips at playhead, combine adjacent clips
- **Keyframe Animation** - Full animation system with interpolation, easing functions, and timeline visualization
  - Animate opacity, scale, rotation, position, volume, color, font size, and more
  - **Unified Editor**: Consistent UI across all clip types (video, text, audio) for keyframe management
  - Visual keyframe markers on timeline with drag-to-reposition support
  - **Auto-Keyframing**: Automatically creates keyframes when you edit a property or drag an element in the preview
  - Multiple easing functions (linear, ease-in, ease-out, ease-in-out, custom cubic-bezier)
  - Real-time preview and WYSIWYG export with animated properties
- **Text Overlays** - Render text clips directly on video preview with positioning and styling
  - Drag to reposition, corner handles to scale, rotation handle above element
  - Edge handles to adjust text width and enable word wrapping
  - **Smart Interaction**: Handles are optimized for touch and remain accessible even near edges
  - Movement thresholds prevent accidental changes from micro-movements
- **Smart Snapping** - Clips snap to other clips, playhead, and timeline boundaries
- **Collision Detection** - Clips on the same track cannot overlap; auto-creates new track with visual feedback
- **Gesture Support** - Pinch-to-zoom, scroll, and drag (touch + mouse)
- **Video Preview** - Synchronized playback with smooth, stutter-free scrubbing
- **Independent Audio** - Decoupled audio playback for background music and sound effects
- **Infinite Timeline** - Automatically expands as you add content; manual control via drag handle
-   **Resizable Interface** - Adjustable track height and sidebar width
-   **Media Sidepanel** - Drag-and-drop media library and SRT subtitle import
-   **Properties Panel** - Non-blocking clip property editor with comprehensive controls
  - Edit video, audio, and text properties while timeline remains interactive
  - Context-sensitive UI adapts to selected clip type
  - **ScrollArea**: Custom styled scrollbars for consistent cross-browser experience
  - All edits support undo/redo with optimized history tracking
-   **Track Management** - Reorder, lock, mute, visibility toggle, and inline renaming
- **Keyboard Shortcuts** - Full keyboard navigation and editing support
- **Export Functionality** - Unified export engine with hybrid pipeline:
  - **Hardware Acceleration**: Up to 10x faster export using WebCodecs (GPU)
  - **Software Fallback**: Robust FFmpeg WASM encoding for compatibility
  - **Customizable**: Configurable resolution (up to 4K), FPS (up to 60), and quality
  - **Frame-Accurate Sync**: Uses `requestVideoFrameCallback` to ensure perfect frame alignment and smooth 60fps output
  - **WYSIWYG Scaling**: Proportional scaling system ensures preview matches export output exactly
- **Video Thumbnails** - Dynamic visual timeline with robust, generated frame previews for video clips
- **Undo/Redo** - Comprehensive history management with optimized tracking for all editing operations
  - All clip/track operations (add, remove, move, trim, split, merge)
  - All property edits (video, audio, text properties)
  - All keyframe operations (add, update, delete, timing/easing changes)
  - Smart history saving on completion (onMouseUp for sliders, onBlur for inputs)
- **Type Safety** - Full TypeScript support with Zod runtime validation
- **Performance Optimized** - Hybrid state management with Zustand + Jotai + Immer
- **Auto-Save & Persistence** - Automatic project saving with adapter pattern for backend flexibility
  - 2-second debounced auto-save (like Google Docs)
  - Multi-project support (create, switch, rename, duplicate, delete)
  - Media files (Video, Audio, Images/Stickers) persisted in IndexedDB across page reloads
  - Adapter pattern for easy migration to cloud storage (Supabase, AWS, etc.)
  - Manual save with Ctrl/Cmd+S

## Installation

```bash
# Using bun
bun add react-video-timeline

# Using npm
npm install react-video-timeline

# Using yarn
yarn add react-video-timeline
```

### Peer Dependencies

```bash
bun add react react-dom
```

## Quick Start

```tsx
import { Timeline, VideoPreview, useTimelineStore } from 'react-video-timeline';
import 'react-video-timeline/styles.css';

function App() {
  const {
    currentTime,
    isPlaying,
    togglePlayback,
    setCurrentTime,
    loadTimeline
  } = useTimelineStore();

  // Load your timeline data
  useEffect(() => {
    loadTimeline(tracks, clips);
  }, []);

  return (
    <div className="app">
      <VideoPreview
        currentTime={currentTime}
        isPlaying={isPlaying}
        onTimeUpdate={setCurrentTime}
      />
      <Timeline
        currentTime={currentTime}
        isPlaying={isPlaying}
        onTimeChange={setCurrentTime}
        onPlayPause={togglePlayback}
      />
    </div>
  );
}
```

## Data Models

### Track

```typescript
interface Track {
  id: string;           // UUID
  name: string;         // Display name
  type: 'video' | 'audio' | 'text' | 'sticker';
  order: number;        // Vertical position (0 = top)
  height: number;       // Track height in pixels (default: 60)
  locked: boolean;      // Prevent editing
  visible: boolean;     // Show/hide track
  muted: boolean;       // Mute audio
  color?: string;       // Custom track color (#RRGGBB)
}
```

### Clip Types

#### Video Clip
```typescript
interface VideoClip {
  id: string;
  trackId: string;
  type: 'video';
  startTime: number;        // Position on timeline (seconds)
  duration: number;         // Clip duration (seconds)
  sourceStartTime: number;  // Offset into source media
  maxDuration?: number;     // Source media total duration
  sourceUrl: string;        // Video file URL
  thumbnailUrl?: string;    // Thumbnail image URL
  thumbnails?: string[];    // Array of thumbnails for strip
  volume: number;           // 0-1
  playbackRate: number;     // Playback speed multiplier
  locked: boolean;
  muted: boolean;
  keyframes?: Keyframe[];   // Optional animation keyframes
}
```

#### Audio Clip
```typescript
interface AudioClip {
  id: string;
  trackId: string;
  type: 'audio';
  startTime: number;
  duration: number;
  sourceStartTime: number;
  sourceUrl: string;
  waveformData?: number[];  // Normalized amplitude data (0-1)
  volume: number;
  fadeIn: number;           // Fade duration in seconds
  fadeOut: number;
  locked: boolean;
  muted: boolean;
  keyframes?: Keyframe[];   // Optional animation keyframes
}
```

#### Text Clip
```typescript
interface TextClip {
  id: string;
  trackId: string;
  type: 'text';
  startTime: number;
  duration: number;
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  color: string;            // #RRGGBB
  backgroundColor?: string;
  textAlign: 'left' | 'center' | 'right';
  position: { x: number; y: number };  // Percentage (unbounded)
  animation: 'none' | 'fade' | 'slide' | 'typewriter';
  locked: boolean;
  muted: boolean;
  keyframes?: Keyframe[];   // Optional animation keyframes
}
```

#### Sticker Clip
```typescript
interface StickerClip {
  id: string;
  trackId: string;
  type: 'sticker';
  startTime: number;
  duration: number;
  assetId: string;
  assetUrl: string;
  scale: number;
  rotation: number;         // Degrees
  opacity: number;          // 0-1
  position: { x: number; y: number };
  locked: boolean;
  muted: boolean;
  keyframes?: Keyframe[];   // Optional animation keyframes
}
```

#### Keyframe
```typescript
interface Keyframe {
  id: string;                // UUID
  property: string;          // Property name (e.g., "opacity", "scale", "position")
  time: number;              // Time relative to clip start (seconds)
  value: number | string | { x: number; y: number };  // Property value
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'cubic-bezier';
  bezier?: {                 // Cubic bezier parameters (if easing === 'cubic-bezier')
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

// Animatable properties by clip type
const ANIMATABLE_PROPERTIES = {
  common: ['opacity', 'scale', 'rotation'],  // All clip types
  video: ['volume', 'position'],
  audio: ['volume', 'pan'],
  text: ['position', 'fontSize', 'color'],
  sticker: ['position']
};
```

## API Reference

### Components

#### `<Timeline />`

Main timeline component with tracks, clips, and playhead.

```tsx
<Timeline
  currentTime={number}      // Current playhead position (seconds)
  isPlaying={boolean}       // Playback state
  onTimeChange={(time: number) => void}  // Called when time changes
  onPlayPause={() => void}  // Called when play/pause is toggled
  className?: string        // Additional CSS classes
/>
```

#### `<VideoPreview />`

Synchronized video player component.

```tsx
<VideoPreview
  currentTime={number}
  isPlaying={boolean}
  onTimeUpdate={(time: number) => void}
  className?: string
/>
```

#### `<PreviewControls />`

Playback and zoom controls bar.

```tsx
<PreviewControls className?: string />
```

#### `<TextOverlay />`

Renders active text clips on top of video preview with interactive editing capabilities.

```tsx
<TextOverlay currentTime={number} containerRef={RefObject<HTMLDivElement>} />
```

Text clips are automatically rendered at their configured positions with styles including:
- Font family, size, weight
- Color and background color
- Text alignment and positioning (x, y as percentage)
- Drop shadow for readability

Interactive features (via `DraggableTextItem`):
- **Drag to move**: Click and drag text to reposition
- **Corner handles**: Scale the text element
- **Rotation handle**: Rotate via handle above the element
- **Edge handles**: Adjust text width (enables word wrapping)
- **Movement thresholds**: Prevents accidental changes from micro-movements (>0.5% for position, >3px for width)

#### `<KeyframeEditor />`

Property editor component for managing keyframes.

```tsx
<KeyframeEditor
  clip={Clip}           // Clip to edit
  property={string}     // Property name (e.g., "opacity")
  label?: string        // Optional display label
/>
```

Features:
- Add keyframes at current playhead position
- Edit keyframe time (displayed as MM:SS:FF timecode) and easing functions
- Live value preview with slider/input controls
- **Click-to-Seek**: Clicking keyframe row seeks playhead to that time
- **Active Highlight**: Yellow border shows keyframe at current playhead
- **Smart Slider**: Shows slider when on keyframe; shows "Click a keyframe" message when between keyframes

#### `<KeyframeMarkers />`

Timeline visualization of keyframes as draggable markers.

```tsx
<KeyframeMarkers
  clip={Clip}
  zoomLevel={number}
  selectedKeyframeId?: string
  onKeyframeClick?: (keyframeId: string, e: React.MouseEvent) => void
/>
```

Features:
- Diamond-shaped markers at keyframe positions
- Drag to reposition keyframes in time
- **Click-to-Seek**: Clicking a keyframe on timeline seeks playhead there
- **Playhead Sync**: Yellow glow when playhead is at keyframe position
- Multi-property indicator (blue dot when multiple properties at same time)
- Yellow highlight during drag operations
- Event isolation prevents accidental clip selection during drag

#### `<ResizablePanel />`

Container with drag handle for resizable height.

```tsx
<ResizablePanel
  minHeight={150}        // Minimum height in pixels
  maxHeight={400}        // Maximum height in pixels
  defaultHeight={224}    // Initial height
  onResize={(height) => void}  // Called when resized
>
  {children}
</ResizablePanel>
```

### Hooks

#### `useTimelineStore()`

Main Zustand store for timeline state.

```tsx
const {
  // State
  currentTime,
  isPlaying,
  zoomLevel,
  scrollX,
  scrollY,
  totalDuration,
  tracks,           // Map<string, Track>
  clips,            // Map<string, Clip>
  selectedClipIds,

  // Actions
  setCurrentTime,
  togglePlayback,
  play,
  pause,
  setZoom,
  setScroll,
  addTrack,
  updateTrack,
  removeTrack,
  addClip,
  updateClip,
  removeClip,
  moveClip,
  trimClip,
  splitClip,        // Split clip at time
  mergeClips,       // Merge adjacent clips
  selectClip,
  deselectAll,
  loadTimeline,
  exportTimeline,
  clearTimeline,
  undo,
  redo,

  // Keyframe actions
  addKeyframeAtCurrentTime,  // Add keyframe at playhead
  updateKeyframe,            // Update keyframe properties
  removeKeyframe,            // Delete keyframe by ID
} = useTimelineStore();
```

#### `usePlayhead()`

Playhead controls and animation.

```tsx
const {
  currentTime,
  isPlaying,
  play,
  pause,
  togglePlayback,
  seekTo,
  seekBy,
  jumpToStart,
  jumpToEnd,
  stepForward,
  stepBackward,
} = usePlayhead();
```

#### `useZoom()`

Zoom level controls.

```tsx
const {
  zoomLevel,
  zoomPercentage,
  minZoom,
  maxZoom,
  setZoomLevel,
  zoomIn,
  zoomOut,
  zoomToFit,
  zoomToRange,
  resetZoom,
} = useZoom();
```

#### `useSnapping(options)`

Snap point calculation.

```tsx
const { snapPoints, findSnapPoint, snapClip } = useSnapping({
  excludeClipId?: string,
  visibleRange?: { start: number, end: number },
  enabled?: boolean,
});
```

### Utilities

#### Time Utilities

```tsx
import {
  timeToPixels,      // (time, zoomLevel) => pixels
  pixelsToTime,      // (pixels, zoomLevel) => time
  formatTimecode,    // (seconds, fps) => "00:00:00"
  formatDuration,    // (seconds) => "4.2s" or "1:30"
  formatRulerLabel,  // (seconds) => "5s" or "1:00"
} from 'react-video-timeline';
```

#### Geometry Utilities

```tsx
import {
  getClipBounds,     // (clip, zoomLevel) => { left, right, width }
  isClipVisible,     // (clip, scrollX, viewportWidth, zoomLevel) => boolean
  getVisibleClips,   // (clips, scrollX, viewportWidth, zoomLevel) => Clip[]
} from 'react-video-timeline';
```

#### Keyframe Utilities

```tsx
import {
  // Core interpolation functions
  getPropertyAtTime,           // Get interpolated property value at time
  getAnimatedPropertiesAtTime, // Get all animated properties for a clip

  // Keyframe queries
  getKeyframesForProperty,     // Get all keyframes for a property
  hasKeyframesForProperty,     // Check if property has keyframes
  getKeyframedProperties,      // Get all properties with keyframes
  findKeyframeAtTime,          // Find keyframe at specific time
  getKeyframesByTime,          // Group keyframes by time

  // Property helpers
  getDefaultForProperty,       // Get default value for a property
  getAnimatableProperties,     // Get animatable properties for clip type

  // Interpolation helpers
  interpolateNumber,           // Interpolate numeric values
  interpolateColor,            // Interpolate hex color values
  interpolatePosition,         // Interpolate position objects
  getEasedProgress,            // Apply easing to progress value
} from 'react-video-timeline';

// Example: Get animated opacity at 2.5s for a clip
const opacity = getPropertyAtTime(
  clip.keyframes || [],
  'opacity',
  2.5,
  1.0  // default value
);

// Example: Get all animated properties at current time
const animated = getAnimatedPropertiesAtTime(clip, currentTime);
console.log(animated.opacity, animated.scale, animated.rotation);
```

#### Export Scaling System

The export engine uses a proportional scaling system to ensure WYSIWYG output across different resolutions:

```tsx
// Reference dimensions
const STICKER_PREVIEW_MAX_SIZE = 300;        // Preview CSS max constraint
const STICKER_PREVIEW_CONTAINER_WIDTH = 420; // Typical preview container width

// Scale factor calculation in renderEngine.ts
const scaleFactor = Math.min(canvasWidth, canvasHeight) / STICKER_PREVIEW_CONTAINER_WIDTH;

// Applied to:
// - Sticker dimensions: 300px → 771px at 1080p
// - Text font size: 24px → 62px at 1080p
// - Text maxWidth, padding, shadows: all scaled proportionally
// - Positions remain percentage-based (inherently proportional)
```

**Examples:**
- **720p (720×1280)**: `scaleFactor = 1.71` → 24px font becomes 41px
- **1080p (1080×1920)**: `scaleFactor = 2.57` → 24px font becomes 62px
- **4K (2160×3840)**: `scaleFactor = 5.14` → 24px font becomes 123px

This ensures that elements maintain the same visual proportion relative to the frame at any export resolution.

### Schema Validators

```tsx
import {
  ClipSchema,
  TrackSchema,
  TimelineSchema,
  KeyframeSchema,
  validateClip,
  validateTrack,
  createTrack,
  createTimeline,
} from 'react-video-timeline';

// Create a new track
const track = createTrack({
  name: 'Video 1',
  type: 'video',
  order: 0
});

// Validate clip data
const result = ClipSchema.safeParse(clipData);
if (result.success) {
  const clip = result.data;
}

// Validate keyframe data
const keyframe = {
  id: crypto.randomUUID(),
  property: 'opacity',
  time: 1.5,
  value: 0.5,
  easing: 'ease-in-out'
};
const kfResult = KeyframeSchema.safeParse(keyframe);
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `Delete` / `Backspace` | Delete selected clips |
| `S` | Split selected clips at playhead |
| `M` | Merge selected clips |
| `Ctrl/Cmd + S` | Save project |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` | Redo |
| `Ctrl/Cmd + A` | Select all clips |
| `Escape` | Deselect all |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `[` | Toggle Sidepanel |
| `Arrow Left/Right` | Navigate timeline |

## Gesture Controls

| Gesture | Action |
|---------|--------|
| **Scroll** | Pan timeline horizontally/vertically |
| **Ctrl/Cmd + Scroll** | Zoom in/out |
| **Shift + Scroll** | Horizontal scroll |
| **Pinch** | Zoom in/out (touch) |
| **Click on clip** | Select clip; seeks playhead to start only if not already within clip |
| **Drag on clip** | Move clip |
| **Drag trim handle** | Trim clip |
| **Click on ruler** | Seek to position |
| **Drag playhead** | Scrub timeline |
| **Drag track bottom** | Resize track height |
| **Drag sidebar edge** | Resize track header width |
| **Double-click track** | Rename track |
| **Drag text overlay** | Reposition text on preview |
| **Drag text corner handle** | Scale text element |
| **Drag text rotation handle** | Rotate text element |
| **Drag text edge handle** | Adjust text width |

## Constants

```tsx
import {
  DEFAULT_ZOOM,         // 50 (pixels per second)
  MIN_ZOOM,             // 10
  MAX_ZOOM,             // 500
  DEFAULT_TRACK_HEIGHT, // 60
  TRACK_HEADER_WIDTH,   // 150
  RULER_HEIGHT,         // 32
  SNAP_THRESHOLD_PX,    // 8
  MIN_CLIP_DURATION,    // 0.1
  MIN_TOUCH_TARGET,     // 44
  DEFAULT_FPS,          // 30
  TRACK_COLORS,         // { video, audio, text, sticker }
  Z_INDEX,              // Centralized stacking order constants
} from 'react-video-timeline';
```

### Z-Index Stacking

The library uses standardized Z-index layers to ensure predictable stacking contexts:

**Preview Order (Back to Front):**
1.  **Track Content**: `Dynamic` (Based on track order)
    *   Tracks higher in the list appear *above* lower tracks.
2.  **Selection Controls**: `40`
3.  **Active Drag Element**: `1500`
4.  **Context Menu**: `2000`

**Timeline Order (Back to Front):**
1.  Tracks (`0`)
2.  Clips (`10`)
3.  Ruler (`30`)
4.  Playhead (`35`)
5.  Sidebar (`40`)
6.  Dragging Header (`50`)
```

## Customization

### Custom Track Colors

```tsx
const track = createTrack({
  name: 'My Track',
  type: 'video',
  order: 0,
  color: '#ff6b6b',  // Custom color
});
```

### Resolution Presets

```tsx
import { RESOLUTION_PRESETS } from 'react-video-timeline';

// Available presets:
// '1080p': { width: 1920, height: 1080 }
// '720p': { width: 1280, height: 720 }
// '4K': { width: 3840, height: 2160 }
// 'Instagram Square': { width: 1080, height: 1080 }
// 'Instagram Story': { width: 1080, height: 1920 }
// 'TikTok': { width: 1080, height: 1920 }
// 'YouTube Shorts': { width: 1080, height: 1920 }
```

## Example: Complete Editor

```tsx
import { useEffect } from 'react';
import {
  Timeline,
  VideoPreview,
  PreviewControls,
  useTimelineStore,
  createTrack,
} from 'react-video-timeline';

function VideoEditor() {
  const store = useTimelineStore();

  useEffect(() => {
    // Initialize with sample data
    const videoTrack = createTrack({ name: 'Video', type: 'video', order: 0 });
    const audioTrack = createTrack({ name: 'Audio', type: 'audio', order: 1 });

    store.setDuration(60);
    store.loadTimeline(
      [videoTrack, audioTrack],
      [
        {
          id: crypto.randomUUID(),
          trackId: videoTrack.id,
          type: 'video',
          startTime: 0,
          duration: 10,
          sourceStartTime: 0,
          sourceUrl: '/video.mp4',
          volume: 1,
          playbackRate: 1,
          locked: false,
          muted: false,
        },
      ]
    );
  }, []);

  return (
    <div className="h-screen flex flex-col">
      {/* Preview */}
      <div className="flex-1 flex items-center justify-center bg-black">
        <VideoPreview
          currentTime={store.currentTime}
          isPlaying={store.isPlaying}
          onTimeUpdate={store.setCurrentTime}
        />
      </div>

      {/* Controls */}
      <PreviewControls />

      {/* Timeline */}
      <div className="h-64">
        <Timeline
          currentTime={store.currentTime}
          isPlaying={store.isPlaying}
          onTimeChange={store.setCurrentTime}
          onPlayPause={store.togglePlayback}
        />
      </div>
    </div>
  );
}
```

## Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Build library
bun run build:lib

# Build demo app
bun run build

# Type check
bun run tsc --noEmit
```

## Browser Support

- Chrome 90+
- Firefox 90+
- Safari 14+
- Edge 90+

## License

MIT

## Troubleshooting
  
### "Failed to load project" Error
If your browser's local storage data becomes corrupted or incompatible after an update, you may see an error screen. We've included a **"Clear Data & Reset"** button on this screen that will:
1. Clear the specific local storage keys for this application.
2. Reload the page to provide a fresh start.
3. This is a safe operation that only affects this application's local data.

## Credits

Design patterns inspired by [img.ly's timeline design article](https://img.ly/blog/designing-a-timeline-for-mobile-video-editing/).
