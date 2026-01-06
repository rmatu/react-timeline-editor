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
-   **Types**:
    -   `VideoClip`: `sourceUrl`, `thumbnailUrl`, `volume`, `thumbnails` (generated cache).
    -   `AudioClip`: `sourceUrl`, `waveformData` (computed RMS peaks), `volume`.
    -   `TextClip`: `content`, `style` (font, size, color), `position` (x/y).

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
    -   **`DurationHandle`**: Draggable handle at the end of the timeline to manually extend total duration.
    -   **`TrackList`**: Renders the vertical list of `Track` components.
        -   **`Track`**: Droppable zone for Dnd.
            -   **`Clip`**: Draggable/Resizable item.
                -   **`TrimHandle`**: Layouts for left/right edge trimming.

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
    -   Extracts frames at regular intervals based on clip duration and pixel width.
    -   Caches results to avoid re-generation during pans/zooms where possible.
    -   Renders as a "filmstrip" of images.

-   **Audio Waveforms**:
    -   Uses `Web Audio API` (`AudioContext.decodeAudioData`).
    -   Fetches the full audio file buffer, decodes it, and calculates RMS (Root Mean Square) amplitude peaks.
    -   Renders as an SVG with discrete rounded bars (frequency visualizer style) for performance and aesthetics.
    -   Logic encapsulated in `useAudioWaveform` hook.

### Export Pipeline
The app supports two export methods (in `src/utils/`):

1.  **FFmpeg (WASM)** (`ffmpegExporter.ts`):
    -   **Primary Method** for high compatibility.
    -   Renders frame-by-frame to an HTML Canvas.
    -   Captures canvas as Blob/File.
    -   Passes files to `ffmpeg.wasm` virtual filesystem.
    -   Encodes using `libx264` (H.264).
    -   **Critical**: Must wait for `seeked` event on video elements to strictly ensure frame accuracy (prevent "slideshow" bug).

2.  **WebCodecs** (`videoExporter.ts`):
    -   **Experimental** (browser support varies).
    -   Uses `VideoEncoder` API.
    -   Faster but less mature than FFmpeg.

## 5. Styling & Assets
-   **Tailwind CSS**: Used for 99% of styling.
-   **`index.css`**: Global resets and specific scrollbar styling.
-   **Icons**: `lucide-react`.

## 6. Guidelines for Future Development
-   **State**: Always add new global "truth" to `timelineStore`. Avoid local state for data that needs to persist or be shared.
-   **Optimization**: Use granular selectors (e.g., `useTimelineStore(state => state.fps)`) to prevent full re-renders of the Timeline on every frame update.
-   **Export**: If modifying export logic, ensure changes are mirrored in both `ffmpegExporter` and `videoExporter` if possible, and ALWAYS verify frame synchronization.

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
