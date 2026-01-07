import { useTimelineStore } from "@/stores/timelineStore";
import { VideoProperties } from "./VideoProperties";
import { AudioProperties } from "./AudioProperties";
import { TextProperties } from "./TextProperties";

export const ContextPanel = () => {
  const selectedClipIds = useTimelineStore((state) => state.selectedClipIds);
  const clips = useTimelineStore((state) => state.clips);

  // Determine what to show
  if (selectedClipIds.length === 0) {
    return null;
  }

  if (selectedClipIds.length > 1) {
     return (
      <div className="flex h-full w-80 min-w-80 flex-col border-l border-zinc-800 bg-zinc-950">
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-zinc-500">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-zinc-900 border border-zinc-800">
            <span className="text-lg font-bold text-zinc-400">{selectedClipIds.length}</span>
          </div>
          <p className="text-sm">Multiple clips selected</p>
        </div>
      </div>
    );
  }

  const clipId = selectedClipIds[0];
  const clip = clips.get(clipId);

  if (!clip) return null; // Should not happen ideally

  return (
    <div className="flex h-full w-80 min-w-80 flex-col border-l border-zinc-800 bg-zinc-950">
      <div className="flex items-center border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">
            {clip.type.charAt(0).toUpperCase() + clip.type.slice(1)} Properties
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4">
        {clip.type === "video" && <VideoProperties clip={clip} />}
        {clip.type === "audio" && <AudioProperties clip={clip} />}
        {clip.type === "text" && <TextProperties clip={clip} />}
        {clip.type === "sticker" && <div className="text-xs text-zinc-500">Sticker properties needed</div>}
      </div>
    </div>
  );
};
