import type { VideoClip } from "@/schemas";
import { useTimelineStore } from "@/stores/timelineStore";
import { KeyframeEditor } from "./KeyframeEditor";
import { Maximize2 } from "lucide-react";

interface VideoPropertiesProps {
  clip: VideoClip;
}

export const VideoProperties = ({ clip }: VideoPropertiesProps) => {
  const updateClip = useTimelineStore((state) => state.updateClip);
  const saveToHistory = useTimelineStore((state) => state.saveToHistory);

  const handleFitToScreen = () => {
    saveToHistory();
    updateClip(clip.id, {
      position: { x: 50, y: 50 },
      scale: 1,
      rotation: 0,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-400">
          Playback Rate
        </label>
        <select
          value={clip.playbackRate}
          onChange={(e) => {
            saveToHistory();
            updateClip(clip.id, { playbackRate: parseFloat(e.target.value) });
          }}
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
        >
          <option value="0.25">0.25x</option>
          <option value="0.5">0.5x</option>
          <option value="1">1x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
        </select>
      </div>

      {/* Transform Quick Actions */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-400">Transform</label>
        <button
          onClick={handleFitToScreen}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          Fit to Screen
        </button>
      </div>

      {/* Keyframe Animation Section */}
      <div className="border-t border-zinc-800 pt-4 mt-4">
        <h3 className="text-xs font-semibold text-zinc-300 mb-3">Keyframe Animation</h3>
        <div className="space-y-4">
          <KeyframeEditor clip={clip} property="opacity" />
          <KeyframeEditor clip={clip} property="scale" />
          <KeyframeEditor clip={clip} property="rotation" />
          <KeyframeEditor clip={clip} property="volume" />
          <KeyframeEditor clip={clip} property="position" />
        </div>
      </div>
    </div>
  );
};
