import type { StickerClip } from "@/schemas";
import { KeyframeEditor } from "./KeyframeEditor";

interface StickerPropertiesProps {
  clip: StickerClip;
}

export const StickerProperties = ({ clip }: StickerPropertiesProps) => {
  return (
    <div className="space-y-4">
      {/* Type indicator for animated GIFs */}
      {clip.isAnimated && (
        <div className="flex items-center gap-2 px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs">
          <span className="animate-pulse">GIF</span>
          <span>Animated Image</span>
        </div>
      )}

      {/* Transform Section - using KeyframeEditor for all transform properties */}
      <div className="">
        <h3 className="text-xs font-semibold text-zinc-300 mb-3">Transform</h3>
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
