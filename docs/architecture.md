# Architecture Documentation

This document describes the high-level architecture, data flow, and component relationships of the `react-video-timeline` application. It serves as a guide for future development to ensure consistency and prevent regressions.

## 1. Core Architecture Pattern

The application follows a **Uni-directional Data Flow** pattern driven by a central store.

-   **State Management**: `Zustand` (`src/stores/timelineStore.ts`).
    -   Serves as the **Single Source of Truth** for the entire application.
    -   Manages `tracks`, `clips`, `currentTime`, `playbackState`, `zoomLevel`, `toolMode`, and `clipboardClips`.
    -   **Tool Mode**: `"select" | "hand"` - Controls interaction behavior (marquee selection vs pan).
    -   **Clipboard**: Stores copied clips for paste/duplicate operations.
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

### Transitions (`Transition`)
-   Visual effects for clip entry/exit, defined in `src/schemas/transition.schema.ts`.
-   Clips have optional `transitionIn` and `transitionOut` properties.
-   **Properties**:
    -   `type`: Transition effect type.
    -   `duration`: Transition duration in seconds (default 0.5s, max half of clip duration).
    -   `easing`: Easing function for the transition.
    -   `bezier`: Optional custom cubic bezier curve.
-   **Transition Types** (16 total):
    -   **Basic**: `fade`, `dissolve`
    -   **Slide**: `slide-left`, `slide-right`, `slide-up`, `slide-down`
    -   **Wipe**: `wipe-left`, `wipe-right`, `wipe-up`, `wipe-down`
    -   **Zoom**: `zoom-in`, `zoom-out`
    -   **Push**: `push-left`, `push-right`, `push-up`, `push-down`
-   **Utilities** (`src/utils/transitions.ts`):
    -   `getTransitionState`: Calculates active transition and progress at a given time.
    -   `getTransitionTransform`: Computes transform values (translate, scale, opacity, clipPath).
    -   `transitionTransformToCSS`: Converts transforms to CSS for preview rendering.
    -   `applyTransitionToContext`: Applies transforms to Canvas2D context for export.

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
    -   **`ProjectsPanel`**: Multi-project management interface.
        -   List, create, rename, duplicate, and delete projects.
        -   Switch between projects with unsaved changes confirmation.
        -   Shows project metadata (creation date, last modified).
    -   **`TransitionsPanel`**: Drag-and-drop transition library.
        -   Displays 16 transition types organized by category (Basic, Slide, Wipe, Zoom, Push).
        -   Drag transitions onto clips to apply (left side = in, right side = out).
        -   Custom MIME type (`application/x-timeline-transition`) for precise drop targeting.
        -   Visual feedback on clips shows which side will receive the transition.

### Preview Engine (`src/components/preview`)
Responsible for WYSIWYG playback and rendering.

-   **`PlayerWrapper`**: Container component that manages the preview Layout.
    -   **Aspect Ratio Management**: Calculates optimal dimensions to strictly respect the selected resolution (e.g., 9:16) while fitting within the parent container.
    -   **Context Provider**: Exposes measurements and refs to children via render prop pattern.
    -   **Interaction Layer**: Handles background clicks for deselecting clips.
    -   **Pan & Zoom Support**: Allows free navigation of the preview canvas.
        -   **Pan**: Alt+drag or middle-click+drag to move the canvas.
        -   **Zoom**: Ctrl/Cmd+scroll to zoom in/out (10% to 500%).
        -   **Tool Mode Aware**: Background drag only pans when `toolMode === "hand"`.
        -   **Reset**: Double-click or button to reset to centered view.

-   **`VideoPreview`**: Main orchestrator.
    -   Uses `PlayerWrapper` to establish layout context.
    -   **Layer Management**: Renders video and audio layers based on active clips.
    -   **`VideoLayer`**: Renders individual `<video>` elements.
        -   **Synchronization**: Manually syncs `currentTime` if drift > 0.2s.
        -   **Ref Management**: Each layer manages its own React Ref to the DOM element.
    -   **`AudioLayer`**: Renders individual `<audio>` elements for independent audio clips.
        -   Decoupled from video playback to ensuring background music plays correctly.
    -   **`TextOverlay`**: Renders text elements over the video.
        -   **Positioning**: Lives outside the overflow-hidden video container but inside `PlayerWrapper` to allow controls to extend beyond video frame.
        -   **`DraggableTextItem`**: Interactive text element with drag, scale, rotate, and width resize capabilities.
            - **Position Dragging**: Auto-detects keyframes on the "position" property. If keyframes exist, dragging creates a new keyframe at the current time; otherwise, it updates the base clip position.
            - **Width Measurement**: Measures inner text content via `scrollWidth` to avoid rotation transform issues with `getBoundingClientRect()`.
            -   **Movement Thresholds**: Requires >0.5% movement for position, >3px for width to prevent accidental changes from micro-movements.
            -   **Deferred Styling**: Width drag styling only applies after threshold is exceeded to prevent premature text wrapping.

-   **`PreviewControls`**:
    -   Play/Pause, Step Frame, Timecode display.
    -   Aspect Ratio selector.

### Timeline Interface (`src/components/timeline`)
Responsible for manipulation and editing.

-   **`Timeline`**: Main scrollable container.
    -   **`TimeRuler`**: Top horizontal axis displaying timecodes. Supports scroll-to-zoom.
    -   **`Playhead`**: Vertical red line indicating `currentTime`.
    -   **`DurationHandle`**: Draggable handle at the end of the timeline to manually adjust total duration. Dragging left "cuts" the timeline, trimming or removing clips that exceed the new duration.
    -   **`ToolModeToolbar`**: Toggle buttons for Select (V) and Hand (H) tools.
        -   **Select Mode**: Enables marquee selection, click-to-select clips.
        -   **Hand Mode**: Enables drag-to-pan timeline.
    -   **`MarqueeSelection`**: Rectangle selection overlay for bulk clip selection.
        -   Only active in Select mode.
        -   Shift+drag adds to existing selection.
        -   Calculates clip intersection with selection rectangle.
    -   **`TrackList`**: Renders the vertical list of `Track` components.
        -   **`Track`**: Droppable zone for Dnd.
            -   **`Clip`**: Draggable/Resizable item.
                -   **Smart Selection**: Clicking a clip selects it and seeks playhead to clip start **only if** playhead is not already within the clip's time range. This prevents disruptive jumps when selecting clips you're already viewing.
                -   **`TrimHandle`**: Layouts for left/right edge trimming.
                -   **`KeyframeMarkers`**: Renders keyframe diamonds at the bottom of clips, draggable for timing adjustments.
                -   **`TransitionIndicator`**: Visual indicator for clip transitions on timeline.
                    -   Shows transition duration as a colored zone at clip edges.
                    -   Displays transition type icon and remove button on hover.
                -   **Transition Drop Target**: Clips accept transition drops from TransitionsPanel.
                    -   Detects drop position (left half = in, right half = out).
                    -   Visual highlight shows which side will receive the transition.

### Properties Panel (`src/components/properties`)
Context-sensitive panel for editing selected clip properties.

-   **`ContextPanel`**: Main container that switches between different property editors based on clip type.
    -   **Non-blocking Modal**: Uses `modal={false}` to allow interaction with timeline while panel is open.
    -   **ScrollArea**: Wraps content in custom Shadcn `ScrollArea` for consistent scrolling experience.
    -   **Persistent State**: Panel remains open until explicitly closed, preserving editing context.
-   **`VideoProperties`**: Controls for video clips (volume, playback rate, etc.).
    -   All edits tracked in history for undo/redo support.
-   **`AudioProperties`**: Controls for audio clips (volume, fade in/out, etc.).
    -   All edits tracked in history for undo/redo support.
-   **`TextProperties`**: Controls for text clips (content, font, color, alignment, etc.).
    -   **Unified Transform UI**: Uses `KeyframeEditor` for Position, Scale, Rotation, and Opacity to match Video properties.
    -   **Width Control**: Dedicated control for `maxWidth` (word wrapping).
    -   All edits tracked in history for undo/redo support.
-   **`StickerProperties`**: Controls for sticker/image clips (transform, animation).
-   **Tabbed Interface**: All property panels use shadcn Tabs for organization.
    -   **Properties Tab**: Main settings, transform controls, keyframe animation.
    -   **Transitions Tab**: Dedicated `TransitionEditor` for in/out transitions.
-   **`TransitionEditor`**: Unified transition editing component.
    -   Separate sections for "In" and "Out" transitions.
    -   Type selection dropdown grouped by category.
    -   Duration slider with intelligent max (half of clip duration).
    -   Easing selection (currently auto-set based on transition type).
    -   Add/remove transition buttons with visual feedback.
-   **`KeyframeEditor`**: Universal keyframe editor component.
    -   Displays current value of any animatable property.
    -   Shows diamond icon to add/indicate keyframes at current playhead position.
    -   Lists all existing keyframes for the property with timecode display (MM:SS:FF format).
    -   **Click-to-Seek**: Clicking a keyframe row seeks the playhead to that position.
    -   **Active Keyframe Highlight**: Yellow border highlights the keyframe at current playhead.
    - **Smart Slider Display**: Always shows slider/input controls. If playhead is not on a keyframe, editing a value automatically creates a new keyframe at that time.
    - Integrated into all property panels for seamless animation workflow.
    - **Smart Editing**: Updates keyframes when present at playhead, otherwise creates new keyframe (if project has keyframes) or updates base clip property.
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
-   **Layer Management**: Renders all layers (video, text, stickers) to HTML Canvas.
    -   **Z-Index Sorting**: Collects all clips from all tracks and sorts them by track order (Z-index) to match preview layering exactly.
-   **Frame Accuracy**: Handles frame-accurate video seeking with `requestVideoFrameCallback` to eliminate lag/stutter in exported videos.
-   Ensures WYSIWYG output by using the same logic for preview and export.
-   **Proportional Scaling**: Applies a scale factor to match preview's visual proportions:
    -   Preview uses fixed constraints (300px max for stickers, absolute font sizes) in a ~420px container
    -   Export scales these values proportionally: `scaleFactor = canvasSize / 420`
    -   For 1080p export: sticker max = 771px, 24px font becomes ~62px
    -   This ensures elements maintain the same relative size across all export resolutions

**2. Proportional Scaling System**:
-   **Reference Dimensions**: Uses 420px as the reference preview container width
-   **Scale Factor Calculation**: `scaleFactor = min(canvasWidth, canvasHeight) / 420`
-   **Sticker Scaling** (`renderStickerLayer`):
    -   Preview constraint: `max-w-[300px] max-h-[300px]` CSS
    -   Export constraint: `300 * scaleFactor` pixels
    -   Maintains same visual proportion across resolutions
-   **Text Scaling** (`renderTextLayer`):
    -   Font size: `baseFontSize * scaleFactor`
    -   Max width: `baseMaxWidth * scaleFactor`
    -   Padding: `basePadding * scaleFactor`
    -   Shadow: `blur/offset * scaleFactor`
-   **Position & Transforms**: Percentage-based (0-100%), inherently proportional

**3. Export Strategies:**
-   **Hardware Accelerated (WebCodecs)** (`webcodecs.ts`) *Primary*:
    -   Uses browser's native `VideoEncoder` for GPU-accelerated encoding.
    -   Significantly faster (up to 10x) on supported browsers.
    -   Uses FFmpeg WASM only for audio mixing and muxing (in some cases).
-   **Software Encoding (FFmpeg WASM)** (`ffmpegExporter.ts`) *Fallback*:
    -   Uses `@ffmpeg/ffmpeg` to encode video frame-by-frame.
    -   **CFR Enforcement**: Uses `-vsync cfr` flag for constant framerate.
    -   Robust fallback for browsers without WebCodecs support.

**4. Routing Logic:**
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
    -   **Click-to-Seek**: Clicking a keyframe diamond on timeline seeks playhead to that position.
    -   **Playhead Sync**: Yellow glow indicates keyframe at current playhead position.
    -   **Drag Feedback**: Yellow highlight during keyframe drag operations.
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

## 8. Known Pitfalls & Lessons Learned

This section documents bugs encountered during development and patterns to avoid in the future.

### CSS Shrink-to-Fit on Absolutely Positioned Elements

**Symptom**: Draggable elements (stickers, images) visually shrink when dragged towards the right edge of their container, even though the `transform: scale()` value remains unchanged.

**Root Cause**: CSS "shrink-to-fit" behavior. When an element has `position: absolute` with no explicit `width`, the browser calculates its width based on available space within the containing block. As `left` percentage increases beyond 100%, the browser reduces the "available width" to zero, causing internal content with `max-width: 100%` to shrink.

**Example of the bug**:
```tsx
// ❌ WRONG - Element will shrink when positioned outside container
<div
  style={{
    position: 'absolute',
    left: `${position.x}%`,  // When x > 100, element shrinks
    top: `${position.y}%`,
    transform: `scale(${scale})`,
  }}
>
  <img style={{ maxWidth: '100%' }} src={url} />
</div>
```

**Solution**: Force the container to use its natural content width:
```tsx
// ✅ CORRECT - Element maintains size regardless of position
<div
  style={{
    position: 'absolute',
    left: `${position.x}%`,
    top: `${position.y}%`,
    width: 'max-content',  // Prevents shrink-to-fit
    transform: `scale(${scale})`,
  }}
>
  <img style={{ maxWidth: '100%' }} src={url} />
</div>
```

**Prevention**: When creating new draggable/positionable components that can move outside their container bounds, always add `width: 'max-content'` (or a fixed width) to prevent CSS shrinkage.

### Stale Closures in Drag Event Handlers

**Symptom**: Drag operations update the wrong properties, or properties get reset to initial values when the mouse is released.

**Root Cause**: Event handlers registered in `useEffect` capture stale values from React state due to JavaScript closures. When `mouseup` fires, it may read outdated state values.

**Example of the bug**:
```tsx
// ❌ WRONG - dragDelta may be stale when handleMouseUp executes
useEffect(() => {
  const handleMouseUp = () => {
    updatePosition(startPos + dragDelta.x);  // dragDelta is stale!
  };
  
  document.addEventListener('mouseup', handleMouseUp);
  return () => document.removeEventListener('mouseup', handleMouseUp);
}, [dragMode]);  // dragDelta not in deps = stale closure
```

**Solution**: Use a ref to hold the current value alongside state:
```tsx
// ✅ CORRECT - Ref always has the latest value
const dragDeltaRef = useRef({ x: 0, y: 0 });

const handleMouseMove = (delta) => {
  dragDeltaRef.current = delta;  // Update ref
  setDragDelta(delta);           // Update state for rendering
};

useEffect(() => {
  const handleMouseUp = () => {
    const delta = dragDeltaRef.current;  // Read from ref, not closure
    updatePosition(startPos + delta.x);
  };
  
  document.addEventListener('mouseup', handleMouseUp);
  return () => document.removeEventListener('mouseup', handleMouseUp);
}, [dragMode]);
```

**Prevention**: For any event handler that needs to read frequently-changing state:
1. Store the value in a ref (`useRef`)
2. Update the ref synchronously in the same function that updates state
3. Read from the ref in event handlers registered via `useEffect`

## 6. Guidelines for Future Development
-   **State**: Always add new global "truth" to `timelineStore`. Avoid local state for data that needs to persist or be shared.
-   **Optimization**: Use granular selectors (e.g., `useTimelineStore(state => state.fps)`) to prevent full re-renders of the Timeline on every frame update.
-   **Export**: If modifying export logic, ensure changes are mirrored in both `ffmpegExporter` and `videoExporter` if possible, and ALWAYS verify frame synchronization.
    -   **Scaling**: When adding new visual elements (text, stickers, etc.), apply the `scaleFactor` to all size-related properties to maintain WYSIWYG consistency.
    -   **Reference**: The 420px reference container width is calibrated for typical preview viewports; adjust if preview UI changes significantly.
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

### Persistence Layer
The app implements a persistence layer with auto-save functionality and adapter pattern for backend flexibility.

**1. Architecture:**
```
src/
├── services/
│   └── persistence/
│       ├── index.ts                    # Barrel exports
│       ├── types.ts                    # TypeScript interfaces
│       ├── constants.ts                # Storage keys, config
│       ├── adapters/
│       │   ├── PersistenceAdapter.ts   # Interface definition
│       │   ├── LocalStorageAdapter.ts  # localStorage implementation
│       │   └── SupabaseAdapter.ts      # Cloud storage stub (future)
│       ├── ProjectManager.ts           # High-level project operations
│       └── MediaStorage.ts             # IndexedDB for media files
├── hooks/
│   ├── useAutoSave.ts                  # Debounced auto-save hook
│   └── useProjectHydration.ts          # Load project on app start
└── schemas/
    └── project.schema.ts               # Zod validation schemas
```

**2. Data Flow:**
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  timelineStore  │────▶│   useAutoSave    │────▶│ PersistenceAdapter│
│ (Zustand)       │     │ (2s debounce)    │     │ (localStorage)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Media Files    │────▶│  MediaStorage    │────▶│   IndexedDB     │
│  (blob URLs)    │     │  (service)       │     │ (file blobs)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

**3. Storage Strategy:**
-   **Project Metadata** → localStorage (`video-timeline:projects`)
    -   List of projects with id, name, createdAt, updatedAt
    -   Active project ID
-   **Project Data** → localStorage (`video-timeline:project:{id}`)
    -   fps, duration, resolution
    -   tracks[], clips[], mediaLibrary[]
-   **Media Files** → IndexedDB (`video-timeline-media`)
    -   Actual video/audio/image file blobs
    -   Referenced by `storageId` in mediaLibrary items

**4. Blob URL Restoration:**
Blob URLs (e.g., `blob:http://localhost:5173/abc-123`) are session-specific and become invalid after page reload. The system handles this by:
1.  **On Import**: When a file is dropped into MediaLibrary:
    -   File is saved to IndexedDB via `mediaStorage.saveMedia()`
    -   A `storageId` reference is stored in the MediaItem
    -   A temporary blob URL is created for immediate playback
2.  **On Save**: Project data (including `storageId` references) is saved to localStorage
3.  **On Reload**: `useProjectHydration` restores media:
    -   Loads project data from localStorage
    -   For each media item with `storageId`, fetches blob from IndexedDB
    -   Creates fresh blob URLs
    -   Updates clip `sourceUrl` references via URL mapping

**5. Auto-Save Behavior:**
-   2-second debounce after state changes
-   10-second max wait for continuous changes
-   Watches: tracks, clips, mediaLibrary, fps, duration, resolution
-   Ignores: currentTime, isPlaying, selection (transient state)
-   `beforeunload` warning if unsaved changes exist
-   **Data Recovery**: Includes a "Clear Data & Reset" mechanism in the error boundary to recover from corrupted localStorage states by selectively clearing project data.

**6. Cloud Migration Strategy:**
When migrating to Supabase (or other cloud storage):
1.  **Implement `SupabaseAdapter`** following `PersistenceAdapter` interface:
    -   `listProjects()` → `supabase.from('projects').select()`
    -   `saveProjectData()` → `supabase.from('projects').upsert()`
    -   etc.
2.  **Media files** will need separate handling:
    -   Upload to Supabase Storage or S3
    -   Store public URL instead of blob URL
    -   Skip IndexedDB on reload (files already remote)
3.  **Swap adapter** at runtime:
    ```typescript
    const supabaseAdapter = new SupabaseAdapter(supabaseClient);
    await projectManager.setAdapter(supabaseAdapter);
    ```
4.  **Sync strategy** considerations:
    -   Optimistic updates (save locally, sync in background)
    -   Conflict resolution for multi-device editing
    -   Offline support with eventual consistency

## 9. Z-Index Strategy

The application uses a centralized set of constants (`src/constants/timeline.constants.ts`) to manage z-index stacking orders, ensuring predictable layering in both the Preview and Timeline.

### Preview Elements (`Z_INDEX.PREVIEW`)
Stacking order from back to front:
- **Background**: `0`
- **Track Content** (Video/Image/Text): `Dynamic`
  - Base value: `10` (`CONTENT_BASE`)
  - Calculated as: `10 + (MaxTrackOrder - TrackOrder)`
  - Tracks higher in the timeline (lower order) stack *above* lower tracks.
- **Overlay Controls**: `40` (Selection handles, guidelines)
- **Dragging Element**: `1500` (Active drag operation)
- **Context Menu**: `2000` (Fixed position, rendered via Portal)

### Timeline Elements (`Z_INDEX.TIMELINE`)
Stacking order from back to front:
-   **Track**: `0` (Base track container)
-   **Clip**: `10`
-   **Controls**: `10` (Track controls) & **Resize Handle**: `10`
-   **Ruler**: `30`
-   **Playhead**: `35` (Above tracks and ruler)
-   **Sidebar**: `40` (Track headers container)
-   **Sidebar Resize**: `45`
-   **Header**: `50` (Active dragging track header)
-   **Drag Preview**: `100` (Ghost element during drag)
