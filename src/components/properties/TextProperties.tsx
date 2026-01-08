import type { TextClip } from "@/schemas";
import { useTimelineStore } from "@/stores/timelineStore";
import { AlignLeft, AlignCenter, AlignRight, Bold } from "lucide-react";
import { KeyframeEditor } from "./KeyframeEditor";

interface TextPropertiesProps {
  clip: TextClip;
}

export const TextProperties = ({ clip }: TextPropertiesProps) => {
  const updateClip = useTimelineStore((state) => state.updateClip);
  const saveToHistory = useTimelineStore((state) => state.saveToHistory);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-400">Content</label>
        <textarea
          value={clip.content}
          onChange={(e) => updateClip(clip.id, { content: e.target.value })}
          onBlur={(e) => {
            saveToHistory();
            updateClip(clip.id, { content: e.target.value });
          }}
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white placeholder-zinc-400 focus:border-blue-500 focus:outline-none min-h-[80px]"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-400">Style</label>
        <div className="flex gap-2">
          <button
            onClick={() => {
              saveToHistory();
              updateClip(clip.id, {
                fontWeight: clip.fontWeight === "bold" ? "normal" : "bold",
              });
            }}
            className={`flex items-center justify-center rounded border border-zinc-700 px-3 py-1 transition-colors ${
              clip.fontWeight === "bold"
                ? "bg-zinc-700 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
            title="Toggle Bold"
          >
            <Bold size={14} />
          </button>
          <div className="flex flex-1 rounded border border-zinc-700 bg-zinc-800 p-0.5">
            {[
              { value: "left", icon: AlignLeft },
              { value: "center", icon: AlignCenter },
              { value: "right", icon: AlignRight },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  saveToHistory();
                  updateClip(clip.id, { textAlign: option.value as any });
                }}
                className={`flex flex-1 items-center justify-center rounded py-1 transition-colors ${
                  clip.textAlign === option.value
                    ? "bg-zinc-700 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <option.icon size={14} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Keyframe Animation Section */}
      <div className="border-t border-zinc-800 pt-4 mt-4">
        <h3 className="text-xs font-semibold text-zinc-300 mb-3">Keyframe Animation</h3>
        <div className="space-y-4">
          <KeyframeEditor clip={clip} property="opacity" />
          <KeyframeEditor clip={clip} property="scale" />
          <KeyframeEditor clip={clip} property="rotation" />
          <KeyframeEditor clip={clip} property="position" />
          <KeyframeEditor clip={clip} property="fontSize" label="Font Size" />
          <KeyframeEditor clip={clip} property="color" />
        </div>
      </div>
    </div>
  );
};
