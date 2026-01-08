import type { VideoClip } from "@/schemas";
import { useTimelineStore } from "@/stores/timelineStore";
import { KeyframeEditor } from "./KeyframeEditor";

interface VideoPropertiesProps {
  clip: VideoClip;
}

export const VideoProperties = ({ clip }: VideoPropertiesProps) => {
  const updateClip = useTimelineStore((state) => state.updateClip);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-400">Volume</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={clip.volume}
            onChange={(e) =>
              updateClip(clip.id, { volume: parseFloat(e.target.value) })
            }
            className="flex-1"
          />
          <span className="w-8 text-xs text-zinc-400">
            {Math.round(clip.volume * 100)}%
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-400">
          Playback Rate
        </label>
        <select
          value={clip.playbackRate}
          onChange={(e) =>
            updateClip(clip.id, { playbackRate: parseFloat(e.target.value) })
          }
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
        >
          <option value="0.25">0.25x</option>
          <option value="0.5">0.5x</option>
          <option value="1">1x</option>
          <option value="1.5">1.5x</option>
          <option value="2">2x</option>
        </select>
      </div>

      {/* Keyframe Animation Section */}
      <div className="border-t border-zinc-800 pt-4 mt-4">
        <h3 className="text-xs font-semibold text-zinc-300 mb-3">Keyframe Animation</h3>
        <div className="space-y-4">
          <KeyframeEditor clip={clip} property="opacity" />
          <KeyframeEditor clip={clip} property="scale" />
          <KeyframeEditor clip={clip} property="rotation" />
          <KeyframeEditor clip={clip} property="volume" />
        </div>
      </div>
    </div>
  );
};
