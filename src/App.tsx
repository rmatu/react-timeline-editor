import { useEffect } from "react";
import { Timeline } from "@/components/timeline";
import { VideoPreview, PreviewControls } from "@/components/preview";
import { ResizablePanel } from "@/components/ResizablePanel";
import { useTimelineStore } from "@/stores/timelineStore";
import { createTrack } from "@/schemas";
import type { VideoClip, AudioClip, TextClip } from "@/schemas";

// Demo data
const demoTracks = [
  createTrack({ name: "Video 1", type: "video", order: 0 }),
  createTrack({ name: "Audio 1", type: "audio", order: 1 }),
  createTrack({ name: "Text", type: "text", order: 2 }),
];

const demoClips: Array<VideoClip | AudioClip | TextClip> = [
  {
    id: crypto.randomUUID(),
    trackId: demoTracks[0].id,
    type: "video",
    startTime: 0,
    duration: 10,
    sourceStartTime: 0,
    maxDuration: 30,
    sourceUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    thumbnailUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Big_Buck_Bunny_thumbnail_vlc.png/400px-Big_Buck_Bunny_thumbnail_vlc.png",
    volume: 1,
    playbackRate: 1,
    locked: false,
    muted: false,
  },
  {
    id: crypto.randomUUID(),
    trackId: demoTracks[0].id,
    type: "video",
    startTime: 12,
    duration: 8,
    sourceStartTime: 5,
    maxDuration: 20,
    sourceUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    volume: 1,
    playbackRate: 1,
    locked: false,
    muted: false,
  },
  {
    id: crypto.randomUUID(),
    trackId: demoTracks[1].id,
    type: "audio",
    startTime: 0,
    duration: 20,
    sourceStartTime: 0,
    sourceUrl: "https://example.com/audio.mp3",
    volume: 0.8,
    fadeIn: 0.5,
    fadeOut: 1,
    locked: false,
    muted: false,
    waveformData: Array.from({ length: 100 }, () => Math.random()),
  },
  {
    id: crypto.randomUUID(),
    trackId: demoTracks[2].id,
    type: "text",
    startTime: 2,
    duration: 5,
    sourceStartTime: 0,
    content: "Hello World!",
    fontFamily: "Inter",
    fontSize: 48,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    position: { x: 50, y: 80 },
    animation: "fade",
    locked: false,
    muted: false,
  },
  {
    id: crypto.randomUUID(),
    trackId: demoTracks[2].id,
    type: "text",
    startTime: 14,
    duration: 4,
    sourceStartTime: 0,
    content: "React Video Timeline",
    fontFamily: "Inter",
    fontSize: 36,
    fontWeight: "normal",
    color: "#ffcc00",
    textAlign: "center",
    position: { x: 50, y: 20 },
    animation: "slide",
    locked: false,
    muted: false,
  },
];

function App() {
  const {
    currentTime,
    isPlaying,
    togglePlayback,
    setCurrentTime,
    loadTimeline,
    setDuration,
  } = useTimelineStore();

  // Load demo data on mount
  useEffect(() => {
    setDuration(30);
    loadTimeline(demoTracks, demoClips);
  }, [loadTimeline, setDuration]);

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      {/* Header */}
      <header className="flex h-12 items-center justify-between border-b border-zinc-800 px-4">
        <h1 className="text-lg font-semibold text-white">
          React Video Timeline
        </h1>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>Drag clips to move</span>
          <span>•</span>
          <span>Drag handles to trim</span>
          <span>•</span>
          <span>Ctrl+Scroll to zoom</span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Video Preview Area - min-h-0 allows it to shrink properly */}
        <div className="flex min-h-0 flex-1 items-center justify-center bg-zinc-900 p-4">
          <VideoPreview
            currentTime={currentTime}
            isPlaying={isPlaying}
            onTimeUpdate={setCurrentTime}
            className="max-h-full"
          />
        </div>

        {/* Preview Controls - flex-shrink-0 ensures it's always visible */}
        <PreviewControls className="mx-4 mb-2 flex-shrink-0" />
      </div>

      {/* Timeline - now resizable */}
      <ResizablePanel
        minHeight={150}
        maxHeight={400}
        defaultHeight={224}
      >
        <Timeline
          currentTime={currentTime}
          isPlaying={isPlaying}
          onTimeChange={setCurrentTime}
          onPlayPause={togglePlayback}
        />
      </ResizablePanel>
    </div>
  );
}

export default App;
