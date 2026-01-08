# Architecture Documentation

This document describes the high-level architecture, data flow, and component relationships of the `react-video-timeline` application. It serves as a guide for future development to ensure consistency and prevent regressions.

## 1. Core Architecture Pattern

The application follows a **Uni-directional Data Flow** pattern driven by a central store.

-   **State Management**: `Zustand` (`src/stores/timelineStore.ts`).
    -   Serves as the **Single Source of Truth** for the entire application.
    -   Manages `tracks`, `clips`, `currentTime`, `playbackState`, and `zoomLevel`.
    -   Uses `immer` middleware for immutable state updates.
    -   Handles complex logic like `undo`/`redo` history stacks.

-   **Sidepanel State**: `useSidepanelStore` (`src/stores/sidepanelStore.ts`).
    -   Manages `isOpen`, `activePanel` (id), and `width`.
    -   Persists state to `localStorage`.

-   **UI Components**: React functional components.
    -   Divided into two main areas: **Preview** (rendering) and **Timeline** (editing).
    -   Components subscribe to specific slices of the store to minimize re-renders (e.g., `useTimelineStore(s => s.currentTime)`).

## 2. Data Model

The core data structures are defined in `src/schemas/index.ts`.

### Tracks (`Track`)
-   Containers for clips.
-   Ordered by an `order` index.
-   Type-specific (`video`, `audio`, `text`) or mixed (currently mixed in implementation, but logically separated).
-   Properties: `id`, `name`, `muted`, `visible`, `locked`.

### Clips (`Clip`)
-   The atomic unit of content.
-   **Common Properties**:
    -   `id`, `trackId`.
    -   `startTime`: Timeline position (seconds).
    -   `duration`: length on timeline (seconds).
    -   `sourceStartTime`: Start point within the source media (for trimming).
    -   `keyframes`: Optional array of animation keyframes for property animations.
-   **Types**:
    -   `VideoClip`: `sourceUrl`, `thumbnailUrl`, `volume`, `thumbnails` (generated cache).
    -   `AudioClip`: `sourceUrl`, `waveformData` (computed RMS peaks), `volume`.
    -   `TextClip`: `content`, `style` (font, size, color), `position` (x/y).

### Keyframes (`Keyframe`)
-   The atomic unit for animations, defined in `src/schemas/keyframe.schema.ts`.
-   **Properties**:
    -   `id`: UUID identifier.
    -   `property`: The property being animated (e.g., "opacity", "scale", "rotation", "position").
    -   `time`: Time relative to clip start (0 = clip start).
    -   `value`: The property value at this keyframe (number, string, or position object).
    -   `easing`: Easing function type ("linear", "ease-in", "ease-out", "ease-in-out", "cubic-bezier").
    -   `bezier`: Optional cubic bezier parameters for custom easing curves.
-   **Animatable Properties**:
    -   **Common (all clips)**: `opacity`, `scale`, `rotation`
    -   **Video clips**: `volume`, `position`
    -   **Audio clips**: `volume`, `pan`
    -   **Text clips**: `position`, `fontSize`, `color`
    -   **Sticker clips**: `position`

## 3. Component Hierarchy

### Root (`App.tsx`)
-   Orchestrates the layout using `ResizablePanel`.
-   integrates `Sidepanel` alongside the timeline.
-   Manages the global `ExportSettingsModal`.

### Sidepanel (`src/components/sidepanel`)
Extensible panel system for secondary tools.

-   **`Sidepanel`**: Main container with resizable width and tab navigation.
-   **`panelRegistry.ts`**: Central configuration for available panels.
-   **Panels**:
    -   **`MediaLibraryPanel`**: File upload, drag & drop to timeline, thumbnail generation.
    -   **`SRTImportPanel`**: Parsers `.srt` files and creating text clips.

### Preview Engine (`src/components/preview`)
Responsible for WYSIWYG playback and rendering.

-   **`VideoPreview`**: Main container.
    -   **Responsive Sizing**: Calculates dimensions to strictly respect the selected aspect ratio (e.g., 9:16) while fitting within the parent container.
    -   **`VideoLayer`**: Renders individual `<video>` elements.
        -   **Synchronization**: Manually syncs `currentTime` if drift > 0.2s.
        -   **Ref Management**: Each layer manages its own React Ref to the DOM element.
    -   **`AudioLayer`**: Renders individual `<audio>` elements for independent audio clips.
        -   Decoupled from video playback to ensuring background music plays correctly.
    -   **`TextOverlay`**: Renders text elements over the video.

-   **`PreviewControls`**:
    -   Play/Pause, Step Frame, Timecode display.
    -   Aspect Ratio selector.

### Timeline Interface (`src/components/timeline`)
Responsible for manipulation and editing.

-   **`Timeline`**: Main scrollable container.
    -   **`TimeRuler`**: Top horizontal axis displaying timecodes. Supports scroll-to-zoom.
    -   **`Playhead`**: Vertical red line indicating `currentTime`.
    -   **`DurationHandle`**: Draggable handle at the end of the timeline to manually adjust total duration. Dragging left "cuts" the timeline, trimming or removing clips that exceed the new duration.
    -   **`TrackList`**: Renders the vertical list of `Track` components.
        -   **`Track`**: Droppable zone for Dnd.
            -   **`Clip`**: Draggable/Resizable item.
                -   **`TrimHandle`**: Layouts for left/right edge trimming.
                -   **`KeyframeMarkers`**: Renders keyframe diamonds at the bottom of clips, draggable for timing adjustments.

### Properties Panel (`src/components/properties`)
Context-sensitive panel for editing selected clip properties.

-   **`ContextPanel`**: Main container that switches between different property editors based on clip type.
    -   **Non-blocking Modal**: Uses `modal={false}` to allow interaction with timeline while panel is open.
    -   **Persistent State**: Panel remains open until explicitly closed, preserving editing context.
-   **`VideoProperties`**: Controls for video clips (volume, playback rate, etc.).
    -   All edits tracked in history for undo/redo support.
-   **`AudioProperties`**: Controls for audio clips (volume, fade in/out, etc.).
    -   All edits tracked in history for undo/redo support.
-   **`TextProperties`**: Controls for text clips (content, font, color, alignment, etc.).
    -   All edits tracked in history for undo/redo support.
-   **`KeyframeEditor`**: Universal keyframe editor component.
    -   Displays current value of any animatable property.
    -   Shows diamond icon to add/indicate keyframes at current playhead position.
    -   Lists all existing keyframes for the property with time, easing, and delete controls.
    -   Integrated into all property panels for seamless animation workflow.
    -   **Smart Editing**: Updates keyframes when present at playhead, otherwise updates base clip property.
    -   **Optimized History**: Uses `onMouseUp`/`onTouchEnd` for sliders, `onBlur` for inputs to prevent history flooding.

## 4. Key Workflows

### Playback Synchronization
1.  **Driver**: `usePlayhead` hook (or internal loop in store).
2.  **Tick**: Updates `currentTime` in the store approx. every 16ms (60fps) via `requestAnimationFrame` when `isPlaying` is true.
3.  **Reaction**:
    -   `Playhead` component updates its `left` CSS position.
    -   `VideoPreview` receives new `currentTime`.
    -   `VideoLayer` compares `currentTime` vs internal video time. If drift is large, it seeks.

### Drag and Drop (Interaction)
User interactions are abstracted into custom hooks in `src/hooks/`:
-   **`useTimelineGestures.ts`**: Handles panning (middle click) and zooming (ctrl + scroll).
-   **`useClipDrag.ts`**: Sophisticated logic for moving clips.
    -   Calculates delta based on `zoomLevel`.
    -   Handles snapping to other clips/playhead (`useSnapping.ts`).
    -   Updates optimistic UI during drag, commits to store on drag end.

### Clip Visualization
Visualization of media on the timeline is handled asynchronously to ensure performance.

-   **Video Thumbnails**:
    -   Generated client-side using an off-screen `HTMLVideoElement` and `Canvas`.
    -   Uses `loadedmetadata` event for reliable metadata loading with timeout fallbacks to prevent hanging states.
    -   Implements a locking mechanism (`generationRef`) to prevent race conditions during rapid re-renders (e.g., scrolling).
    -   Extracts frames at regular intervals based on clip duration and pixel width.
    -   Renders as a "filmstrip" of images.

-   **Audio Waveforms**:
    -   Uses `Web Audio API` (`AudioContext.decodeAudioData`).
    -   Fetches the full audio file buffer, decodes it, and calculates RMS (Root Mean Square) amplitude peaks.
    -   Renders as an SVG with discrete rounded bars (frequency visualizer style) for performance and aesthetics.
    -   Logic encapsulated in `useAudioWaveform` hook.

### Export Pipeline
The app uses a unified export system (in `src/utils/export/`) with a hybrid engine approach:

**1. Unified Render Engine** (`renderEngine.ts`):
-   Central rendering class that mirrors `VideoPreview.tsx` behavior exactly.
-   Renders all layers (video, text, stickers) to HTML Canvas.
-   Handles frame-accurate video seeking with `requestVideoFrameCallback`.
-   Ensures WYSIWYG output by using the same logic for preview and export.

**2. Export Strategies:**
-   **Hardware Accelerated (WebCodecs)** (`webcodecs.ts`) *Primary*:
    -   Uses browser's native `VideoEncoder` for GPU-accelerated encoding.
    -   Significantly faster (up to 10x) on supported browsers.
    -   Uses FFmpeg WASM only for audio mixing and muxing (in some cases).
-   **Software Encoding (FFmpeg WASM)** (`ffmpegExporter.ts`) *Fallback*:
    -   Uses `@ffmpeg/ffmpeg` to encode video frame-by-frame.
    -   **CFR Enforcement**: Uses `-vsync cfr` flag for constant framerate.
    -   Robust fallback for browsers without WebCodecs support.

**3. Routing Logic:**
-   User preference is handled via `useHardwareAcceleration` in `ExportSettingsModal`.
-   `App.tsx` routes the request to the appropriate exporter based on settings and browser support.

### Keyframe Animation System
The app includes a comprehensive keyframe animation system (in `src/utils/keyframes.ts` and `src/schemas/keyframe.schema.ts`):

**1. Data Structure:**
-   Each clip can have an optional `keyframes` array.
-   Keyframes store property, time (relative to clip start), value, and easing function.
-   Supports multiple keyframes per property for complex animations.

**2. Interpolation Engine:**
-   **Easing Functions**: Linear, ease-in, ease-out, ease-in-out, and custom cubic-bezier curves.
-   **Value Types**: Numbers (opacity, scale, volume), colors (hex interpolation), positions (x/y objects).
-   **`getPropertyAtTime()`**: Core interpolation function that calculates property values at any time point.
    -   Finds surrounding keyframes and interpolates between them using the easing function.
    -   Falls back to default values if no keyframes exist.
    -   Returns constant values before first/after last keyframe.

**3. UI Components:**
-   **`KeyframeEditor`**: Property editor with add/list/edit keyframe controls.
    -   Diamond icon shows keyframe status at current playhead position.
    -   Inline editing of keyframe time, easing, and value.
    -   Live preview updates as you adjust values.
-   **`KeyframeMarkers`**: Timeline visualization of keyframes as draggable diamond shapes.
    -   Positioned at the bottom of clips on the timeline.
    -   Supports drag-to-reposition via `useKeyframeDrag` hook.
    -   Visual indicator shows multiple properties at same time point.
    -   Uses memoized pointer event wrapping to prevent event bubbling to parent clip during drag.

**4. Preview & Export Integration:**
-   **Preview**: `VideoPreview.tsx` calls `getAnimatedPropertiesAtTime()` for each clip to apply transforms.
-   **Export**: `renderEngine.ts` uses the same `getAnimatedPropertiesAtTime()` function to ensure WYSIWYG output.
-   **Synchronization**: Both preview and export use identical interpolation logic from `keyframes.ts`.
-   **Performance**: Memoized calculations prevent unnecessary recalculations during playback.

**5. Store Actions:**
-   `addKeyframeAtCurrentTime()`: Creates a keyframe at the playhead with current property value.
-   `updateKeyframe()`: Updates keyframe time, value, or easing.
-   `removeKeyframe()`: Deletes a keyframe by ID.
-   All actions support undo/redo through the history system.

### Undo/Redo System
The app implements a comprehensive history tracking system for all editing operations (in `src/stores/timelineStore.ts`):

**1. History Structure:**
-   Stores snapshots of `tracks` and `clips` state in an array.
-   Maintains a `historyIndex` pointer for navigation.
-   Limits history to 50 entries (configurable via `maxHistoryLength`).

**2. Tracked Operations:**
-   **Clip Operations**: Add, remove, move, trim, split, merge
-   **Track Operations**: Add, remove, reorder
-   **Property Edits**: All changes in VideoProperties, AudioProperties, TextProperties
-   **Keyframe Operations**: Add, update, delete, change timing/easing
-   **Drag & Drop**: Clip dragging, trimming handles, keyframe repositioning

**3. History Optimization Pattern:**
-   **Before Action**: `saveToHistory()` is called before the operation executes.
-   **Range Sliders**: Use `onMouseUp`/`onTouchEnd` to save history only after dragging completes.
-   **Text/Number Inputs**: Use `onBlur` to save history only after editing finishes.
-   **Immediate Actions**: Buttons, dropdowns, and single-click operations save immediately.
-   **Result**: Clean undo stack with one entry per complete user action, no intermediate states.

**4. Implementation Pattern:**
```typescript
// Example from property panels:
const saveToHistory = useTimelineStore((state) => state.saveToHistory);

// Slider: save on release, not during drag
<input
  type="range"
  onChange={(e) => updateValue(e.target.value)}
  onMouseUp={(e) => {
    saveToHistory();
    updateValue(e.target.value);
  }}
/>

// Text input: save on blur, not during typing
<input
  type="text"
  onChange={(e) => updateValue(e.target.value)}
  onBlur={(e) => {
    saveToHistory();
    updateValue(e.target.value);
  }}
/>

// Button: save immediately on click
<button onClick={() => {
  saveToHistory();
  performAction();
}}>
```

**5. Keyboard Shortcuts:**
-   `Ctrl/Cmd + Z`: Undo - reverts to previous history state
-   `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y`: Redo - moves forward in history

## 5. Styling & Assets
-   **Tailwind CSS**: Used for 99% of styling.
-   **`index.css`**: Global resets and specific scrollbar styling.
-   **Icons**: `lucide-react`.

## 6. Guidelines for Future Development
-   **State**: Always add new global "truth" to `timelineStore`. Avoid local state for data that needs to persist or be shared.
-   **Optimization**: Use granular selectors (e.g., `useTimelineStore(state => state.fps)`) to prevent full re-renders of the Timeline on every frame update.
-   **Export**: If modifying export logic, ensure changes are mirrored in both `ffmpegExporter` and `videoExporter` if possible, and ALWAYS verify frame synchronization.
-   **Undo/Redo**: When adding new editing features, always call `saveToHistory()` before state mutations. For continuous inputs (sliders, text fields), use `onMouseUp`/`onBlur` to avoid flooding the history stack.

## 7. Business Logic & Mechanics

### The "Three Timestamps" System
The core logic for handling video clips relies on three key properties:
1.  **`startTime`**: The position in seconds where the clip begins on the **Timeline**.
2.  **`duration`**: How long the clip plays on the Timeline.
3.  **`sourceStartTime`**: The starting point within the **original source file**.

**Example:**
If you have a 1-minute video file, but you want to show the segment from 0:10 to 0:20 at the very beginning of your movie:
- `startTime`: `0` (Starts at 0s on timeline)
- `duration`: `10` (Plays for 10s)
- `sourceStartTime`: `10` (Skips the first 10s of the source file)

### Clipping & Trimming Logic
Trimming is handled in `src/hooks/useClipTrim.ts`.

-   **Left Trim**:
    -   Moving the left handle to the **right** (cutting start):
        -   Increases `startTime`.
        -   Decreases `duration`.
        -   Increases `sourceStartTime` (we skip more of the beginning).
    -   Moving the left handle to the **left** (extending start):
        -   Decreases `startTime` (can't go < 0).
        -   Increases `duration`.
        -   Decreases `sourceStartTime` (can't go < 0).

-   **Right Trim**:
    -   Changes only `duration`.
    -   Left side and source reference remain constant.
    -   Constrained by:
        -   `startTime + duration` cannot exceed Timeline total duration.
        -   If file has finite duration (e.g., video/audio), `sourceStartTime + duration` cannot exceed media length.

### Drag & Drop Mechanics
Handled in `src/hooks/useClipDrag.ts`.

-   **Optimistic UI**: Dragging does not update the store immediately. It uses local React state to render the moving clip "ghost" for 60fps performance. Store update happens only on `dragEnd`.
-   **Snapping**:
    -   Calculated in `src/utils/snapping.ts`.
    -   Snaps to:
        -   Timeline Start/End.
        -   Playhead.
        -   Start/End of other clips on *any* track.
    -   Threshold adapts to `zoomLevel` (snapping feels consistent regardless of zoom).
-   **Track Switching**:
    -   Dragging vertically calculates which track row the cursor is over.
    -   "Phantom Tracks": Dragging to the very top or bottom creates a temporary drop zone. Dropping there automatically creates a new track.
-   **Collision Detection**:
    -   Clips on the same track cannot overlap.
    -   Uses `wouldClipsOverlap()` from `src/utils/snapping.ts` during drag.
    -   If a drop would cause overlap, the clip is automatically placed on a **new track** at the top.
    -   Visual indicator (`NewTrackIndicator`) shows amber warning: "⚠️ Overlapping – Will Create New Track".
    -   State tracked via `collisionDetectedAtom` in `SnapGuide.tsx`.

### Split & Merge
Clip splitting and merging are handled via store actions (`splitClip`, `mergeClips`).

-   **Split** (`S` key or toolbar button):
    -   Divides a clip at the current playhead position into two separate clips.
    -   Validates that the split time is within the clip bounds (not at edges).
    -   Creates two new clips:
        -   **Left Clip**: Keeps the original `startTime`, but `duration` ends at split point.
        -   **Right Clip**: Starts at split point, has adjusted `sourceStartTime` for video/audio clips.
    -   Both resulting clips are selected after the operation.

-   **Merge** (`M` key or toolbar button):
    -   Combines two or more selected clips into a single clip.
    -   Requirements:
        -   All clips must be the same type.
        -   All clips must be on the same track.
        -   Clips must be adjacent (within 0.1s tolerance).
        -   For video/audio: must have the same `sourceUrl` and contiguous `sourceStartTime` ranges.
    -   Creates a merged clip spanning the full duration.
    -   The merged clip is selected after the operation.

-   **Undo/Redo**: Both operations save to history before executing, enabling full undo/redo support.
