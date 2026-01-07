import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "sonner";
import { PanelLeft } from "lucide-react";
import { Timeline } from "@/components/timeline";
import { VideoPreview, PreviewControls } from "@/components/preview";
import { ResizablePanel } from "@/components/ResizablePanel";
import { Sidepanel } from "@/components/sidepanel";
import { useTimelineStore, type MediaItem } from "@/stores/timelineStore";
import { useSidepanelStore } from "@/stores/sidepanelStore";
import { createTrack } from "@/schemas";
import type { VideoClip, AudioClip, TextClip } from "@/schemas";
import { exportToMp4 } from "@/utils/ffmpegExporter";
import { ExportSettingsModal, type ExportSettings } from "@/components/ExportSettingsModal";
import { ContextPanel } from "@/components/properties/ContextPanel";

// Demo data - using local example files from /files folder
const demoTracks = [
  createTrack({ name: "Video", type: "video", order: 0 }),
  createTrack({ name: "Audio", type: "audio", order: 1 }),
  createTrack({ name: "Subtitles", type: "text", order: 2 }),
];

// Text clips generated from example-dubbing.srt
const demoClips: Array<VideoClip | AudioClip | TextClip> = [
  // Video clip - local MP4 file
  {
    id: crypto.randomUUID(),
    trackId: demoTracks[0].id,
    type: "video",
    startTime: 0,
    duration: 25,
    sourceStartTime: 0,
    maxDuration: 120, // Approximate duration of the example video
    sourceUrl: "/files/file_example_MP4_1920_18MG.mp4",
    volume: 1,
    playbackRate: 1,
    locked: false,
    muted: false,
  },
  // Audio clip - local MP3 file
  {
    id: crypto.randomUUID(),
    trackId: demoTracks[1].id,
    type: "audio",
    startTime: 0,
    duration: 25,
    sourceStartTime: 0,
    sourceUrl: "/files/file_example_MP3_700KB.mp3",
    volume: 0.8,
    fadeIn: 0.5,
    fadeOut: 1,
    locked: false,
    muted: false,
  },
  // Subtitle 1: 00:00:00,000 --> 00:00:02,500
  {
    id: crypto.randomUUID(),
    trackId: demoTracks[2].id,
    type: "text",
    startTime: 0,
    duration: 2.5,
    sourceStartTime: 0,
    content: "Welcome to the Example Subtitle File!",
    fontFamily: "Inter",
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    position: { x: 50, y: 85 },
    animation: "fade",
    locked: false,
    muted: false,
  },
  // Subtitle 2: 00:00:03,000 --> 00:00:06,000
  {
    id: crypto.randomUUID(),
    trackId: demoTracks[2].id,
    type: "text",
    startTime: 3,
    duration: 3,
    sourceStartTime: 0,
    content: "This is a demonstration of SRT subtitles.",
    fontFamily: "Inter",
    fontSize: 32,
    fontWeight: "normal",
    color: "#ffffff",
    textAlign: "center",
    position: { x: 50, y: 85 },
    animation: "fade",
    locked: false,
    muted: false,
  },
  // Subtitle 3: 00:00:07,000 --> 00:00:10,500
  {
    id: crypto.randomUUID(),
    trackId: demoTracks[2].id,
    type: "text",
    startTime: 7,
    duration: 3.5,
    sourceStartTime: 0,
    content: "You can use SRT files to add subtitles to your videos.",
    fontFamily: "Inter",
    fontSize: 32,
    fontWeight: "normal",
    color: "#ffffff",
    textAlign: "center",
    position: { x: 50, y: 85 },
    animation: "fade",
    locked: false,
    muted: false,
  },
  // Subtitle 4: 00:00:12,000 --> 00:00:15,000
  {
    id: crypto.randomUUID(),
    trackId: demoTracks[2].id,
    type: "text",
    startTime: 12,
    duration: 3,
    sourceStartTime: 0,
    content: "Each subtitle entry consists of a number, a timecode, and the subtitle text.",
    fontFamily: "Inter",
    fontSize: 28,
    fontWeight: "normal",
    color: "#ffffff",
    textAlign: "center",
    position: { x: 50, y: 85 },
    animation: "fade",
    locked: false,
    muted: false,
  },
];

// Initial media library items - single source of truth
const demoMediaLibrary: MediaItem[] = [
  {
    id: crypto.randomUUID(),
    name: 'file_example_MP4_1920_18MG.mp4',
    type: 'video',
    url: '/files/file_example_MP4_1920_18MG.mp4',
  },
  {
    id: crypto.randomUUID(),
    name: 'file_example_MP3_700KB.mp3',
    type: 'audio',
    url: '/files/file_example_MP3_700KB.mp3',
  },
  {
    id: crypto.randomUUID(),
    name: 'example-dubbing.srt',
    type: 'srt',
    url: '/files/example-dubbing.srt',
    subtitles: [
      { index: 1, startTime: 0, endTime: 2.5, text: 'Welcome to the Example Subtitle File!' },
      { index: 2, startTime: 3, endTime: 6, text: 'This is a demonstration of SRT subtitles.' },
      { index: 3, startTime: 7, endTime: 10.5, text: 'You can use SRT files to add subtitles to your videos.' },
      { index: 4, startTime: 12, endTime: 15, text: 'Each subtitle entry consists of a number, a timecode, and the subtitle text.' },
      { index: 5, startTime: 16, endTime: 20, text: 'The timecode format is hours:minutes:seconds,milliseconds.' },
      { index: 6, startTime: 21, endTime: 25, text: 'You can adjust the timing to match your video.' },
      { index: 7, startTime: 26, endTime: 30, text: 'Make sure the subtitle text is clear and readable.' },
      { index: 8, startTime: 31, endTime: 35, text: "And that's how you create an SRT subtitle file!" },
      { index: 9, startTime: 36, endTime: 40, text: 'Enjoy adding subtitles to your videos!' },
    ],
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
  const toggleSidepanel = useSidepanelStore((s) => s.toggle);

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
    loadTimeline(demoTracks, demoClips, demoMediaLibrary);
  }, [loadTimeline, setDuration]);

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      {/* Header */}
      <header className="flex h-12 items-center justify-between border-b border-zinc-800 px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidepanel}
            title="Toggle sidepanel ([)"
            className="flex items-center justify-center w-8 h-8 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <PanelLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold text-white">
            React Video Timeline
          </h1>
        </div>
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
      <div className="flex flex-1 overflow-hidden">
        {/* Sidepanel */}
        <Sidepanel />

        {/* Content Area */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
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

        {/* Right Context Panel */}
        <ContextPanel />
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
      <Toaster position="top-right" theme="dark" />
      
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
