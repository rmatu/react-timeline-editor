import type { StickerClip } from "@/schemas";
import { useTimelineStore } from "@/stores/timelineStore";
import { KeyframeEditor } from "./KeyframeEditor";
import { Maximize2 } from "lucide-react";

interface StickerPropertiesProps {
  clip: StickerClip;
}

export const StickerProperties = ({ clip }: StickerPropertiesProps) => {
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
      {/* Type indicator for animated GIFs */}
      {clip.isAnimated && (
        <div className="flex items-center gap-2 px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">
          <span className="animate-pulse">GIF</span>
          <span>Animated Image</span>
        </div>
      )}

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

      {/* Transform Section - using KeyframeEditor for all transform properties */}
      <div className="">
        <h3 className="text-xs font-semibold text-zinc-300 mb-3">Keyframe Animation</h3>
        <div className="space-y-4">
          <KeyframeEditor clip={clip} property="position" />
          <KeyframeEditor clip={clip} property="scale" />
          <KeyframeEditor clip={clip} property="rotation" />
          <KeyframeEditor clip={clip} property="opacity" />
        </div>
      </div>
    </div>
  );
};
