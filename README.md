# React Video Timeline

A high-performance, touch-friendly React component library for video timeline editing. Built with TypeScript, featuring multi-track support, gesture controls, and synchronized video preview.

## Features

- **Multi-track Timeline** - Support for video, audio, text, and sticker tracks
- **Clip Manipulation** - Drag to reposition, trim handles to adjust duration
- **Text Overlays** - Render text clips directly on video preview with positioning and styling
- **Smart Snapping** - Clips snap to other clips, playhead, and timeline boundaries
- **Gesture Support** - Pinch-to-zoom, scroll, and drag (touch + mouse)
- **Video Preview** - Synchronized playback with smooth, stutter-free scrubbing
- **Independent Audio** - Decoupled audio playback for background music and sound effects
- **Infinite Timeline** - Automatically expands as you add content; manual control via drag handle
- **Resizable Interface** - Adjustable track height and sidebar width
- **Track Management** - Reorder, lock, mute, visibility toggle, and inline renaming
- **Keyboard Shortcuts** - Full keyboard navigation and editing support
- **Export Functionality** - Client-side MP4 export via FFmpeg.wasm with configurable resolution, FPS, and quality settings
- **Video Thumbnails** - Dynamic visual timeline with generated frame previews for video clips
- **Undo/Redo** - Full history management for all editing operations
- **Type Safety** - Full TypeScript support with Zod runtime validation
- **Performance Optimized** - Hybrid state management with Zustand + Jotai + Immer

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
  position: { x: number; y: number };  // Percentage (0-100)
  animation: 'none' | 'fade' | 'slide' | 'typewriter';
  locked: boolean;
  muted: boolean;
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
}
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

Renders active text clips on top of video preview.

```tsx
<TextOverlay currentTime={number} />
```

Text clips are automatically rendered at their configured positions with styles including:
- Font family, size, weight
- Color and background color
- Text alignment and positioning (x, y as percentage)
- Drop shadow for readability

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
  selectClip,
  deselectAll,
  loadTimeline,
  exportTimeline,
  clearTimeline,
  undo,
  redo,
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

### Schema Validators

```tsx
import {
  ClipSchema,
  TrackSchema,
  TimelineSchema,
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
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `Delete` / `Backspace` | Delete selected clips |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` | Redo |
| `Ctrl/Cmd + A` | Select all clips |
| `Escape` | Deselect all |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `Arrow Left/Right` | Navigate timeline |

## Gesture Controls

| Gesture | Action |
|---------|--------|
| **Scroll** | Pan timeline horizontally/vertically |
| **Ctrl/Cmd + Scroll** | Zoom in/out |
| **Shift + Scroll** | Horizontal scroll |
| **Pinch** | Zoom in/out (touch) |
| **Drag on clip** | Move clip |
| **Drag trim handle** | Trim clip |
| **Click on ruler** | Seek to position |
| **Drag playhead** | Scrub timeline |
| **Drag track bottom** | Resize track height |
| **Drag sidebar edge** | Resize track header width |
| **Double-click track** | Rename track |

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
} from 'react-video-timeline';
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

## Credits

Design patterns inspired by [img.ly's timeline design article](https://img.ly/blog/designing-a-timeline-for-mobile-video-editing/).
