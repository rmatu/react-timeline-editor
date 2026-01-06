import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "sonner";
import { Timeline } from "@/components/timeline";
import { VideoPreview, PreviewControls } from "@/components/preview";
import { ResizablePanel } from "@/components/ResizablePanel";
import { useTimelineStore } from "@/stores/timelineStore";
import { createTrack } from "@/schemas";
import type { VideoClip, AudioClip, TextClip } from "@/schemas";
import { exportToMp4 } from "@/utils/ffmpegExporter";
import { ExportSettingsModal, type ExportSettings } from "@/components/ExportSettingsModal";

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
    // sourceUrl: "https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav", // WAV might be big.
    // Let's stick to the google bucket sample, it works.
    sourceUrl: "https://commondatastorage.googleapis.com/codeskulptor-demos/riceracer_assets/music/race1.ogg",
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
    exportTimeline,
    setDuration,
  } = useTimelineStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const handleExportJson = () => {
    const data = exportTimeline();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "timeline-export.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportMp4 = async (settings: ExportSettings) => {
    if (isExporting) return;
    
    // FFmpeg.wasm requires SharedArrayBuffer which requires secure context (https) and specific headers
    // We added headers in vite.config.ts. 
    // It should work in Dev (localhost) and correctly configured Production.

    try {
      setIsExporting(true);
      const store = useTimelineStore.getState();
      const toastId = toast.loading("Exporting video... (Rendering + Encoding)");

      const blob = await exportToMp4({
        width: settings.width,
        height: settings.height,
        fps: settings.fps,
        quality: settings.quality,
        filename: settings.filename,
        duration: store.totalDuration,
        tracks: store.tracks,
        clips: store.clips,
        onProgress: (progress) => {
          // Show different messages based on phase (approximate)
          if (progress < 0.8) {
              toast.loading(`Rendering... ${Math.round(progress/0.8 * 100)}%`, { id: toastId });
          } else {
              toast.loading(`Encoding... ${Math.round((progress-0.8)/0.2 * 100)}%`, { id: toastId });
          }
        },
      });

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${settings.filename}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Export complete!", { id: toastId });
      setIsExportModalOpen(false); // Close modal on success
    } catch (error) {
      console.error(error);
      toast.error("Failed to export video", { 
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Load demo data on mount
  useEffect(() => {
    // setDuration(30); // Removed to allow default duration and auto-extension
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJson}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            Export JSON
          </button>
          <button
            onClick={() => setIsExportModalOpen(true)}
            disabled={isExporting}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? "Exporting..." : "Export MP4"}
          </button>
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
      <Toaster position="bottom-center" theme="dark" />
      
      <ExportSettingsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExportMp4}
        isExporting={isExporting}
        defaultSettings={{
             // Pre-fill with store values if desired, for now defaults in component are fine
        }}
      />
    </div>
  );
}

export default App;
