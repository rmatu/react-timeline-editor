import type { AudioClip } from "@/schemas";
import { useTimelineStore } from "@/stores/timelineStore";
import { KeyframeEditor } from "./KeyframeEditor";

interface AudioPropertiesProps {
  clip: AudioClip;
}

export const AudioProperties = ({ clip }: AudioPropertiesProps) => {
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
        <label className="text-xs font-medium text-zinc-400">Fade In (s)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="0.1"
            value={clip.fadeIn}
            onChange={(e) =>
              updateClip(clip.id, { fadeIn: parseFloat(e.target.value) })
            }
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-400">Fade Out (s)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="0.1"
            value={clip.fadeOut}
            onChange={(e) =>
              updateClip(clip.id, { fadeOut: parseFloat(e.target.value) })
            }
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white placeholder-zinc-400 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Keyframe Animation Section */}
      <div className="border-t border-zinc-800 pt-4 mt-4">
        <h3 className="text-xs font-semibold text-zinc-300 mb-3">Keyframe Animation</h3>
        <div className="space-y-4">
          <KeyframeEditor clip={clip} property="volume" />
          <KeyframeEditor clip={clip} property="pan" label="Pan (L/R)" />
        </div>
      </div>
    </div>
  );
};
