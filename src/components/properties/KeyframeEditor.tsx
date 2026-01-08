import { useMemo } from "react";
import { Diamond, Trash2 } from "lucide-react";
import { useTimelineStore } from "@/stores/timelineStore";
import type { Clip } from "@/schemas";
import type { EasingType, KeyframeValue, PositionValue } from "@/schemas/keyframe.schema";
import { PROPERTY_META, type PropertyMeta } from "@/schemas/keyframe.schema";
import {
  getKeyframesForProperty,
  getPropertyAtTime,
  getDefaultForProperty,
} from "@/utils/keyframes";
import { formatTimecode, parseTimecode } from "@/utils/time";
import { cn } from "@/lib/utils";

interface KeyframeEditorProps {
  clip: Clip;
  property: string;
  label?: string;
}

export function KeyframeEditor({ clip, property, label }: KeyframeEditorProps) {
  const currentTime = useTimelineStore((state) => state.currentTime);
  const addKeyframeAtCurrentTime = useTimelineStore(
    (state) => state.addKeyframeAtCurrentTime
  );
  const updateKeyframe = useTimelineStore((state) => state.updateKeyframe);
  const removeKeyframe = useTimelineStore((state) => state.removeKeyframe);
  const updateClip = useTimelineStore((state) => state.updateClip);
  const saveToHistory = useTimelineStore((state) => state.saveToHistory);

  const meta: PropertyMeta = PROPERTY_META[property] || {
    label: property,
    valueType: "number",
  };

  const keyframes = useMemo(
    () => getKeyframesForProperty(clip.keyframes || [], property),
    [clip.keyframes, property]
  );

  const clipTime = currentTime - clip.startTime;
  const isWithinClip = clipTime >= 0 && clipTime <= clip.duration;

  const currentValue = useMemo(() => {
    return getPropertyAtTime(
      clip.keyframes || [],
      property,
      clipTime,
      getDefaultForProperty(clip, property)
    );
  }, [clip, property, clipTime]);

  const hasKeyframeAtCurrentTime = useMemo(() => {
    return keyframes.some((kf) => Math.abs(kf.time - clipTime) < 0.017);
  }, [keyframes, clipTime]);

  const handleAddKeyframe = () => {
    if (!isWithinClip) return;
    saveToHistory();
    addKeyframeAtCurrentTime(clip.id, property, currentValue);
  };

  const handleValueChange = (value: KeyframeValue) => {
    // Check if there's a keyframe at current time
    const existingKf = keyframes.find(
      (kf) => Math.abs(kf.time - clipTime) < 0.017
    );

    if (existingKf) {
      // Update the keyframe value
      updateKeyframe(clip.id, existingKf.id, { value });
    } else if (isWithinClip) {
      // No keyframe at current time - update base clip property
      updateClip(clip.id, { [property]: value } as Partial<Clip>);
    }
  };

  const handleValueCommit = (value: KeyframeValue) => {
    // Save history before committing the final value
    saveToHistory();
    handleValueChange(value);
  };

  return (
    <div className="space-y-2">
      {/* Header with label and add button */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-zinc-400">
          {label || meta.label}
        </label>
        <button
          onClick={handleAddKeyframe}
          disabled={!isWithinClip}
          className={cn(
            "flex items-center gap-1 text-xs transition-colors",
            isWithinClip
              ? hasKeyframeAtCurrentTime
                ? "text-yellow-400"
                : "text-zinc-500 hover:text-blue-400"
              : "text-zinc-600 cursor-not-allowed"
          )}
          title={
            hasKeyframeAtCurrentTime
              ? "Keyframe exists at current time"
              : "Add keyframe at current time"
          }
        >
          <Diamond
            size={10}
            className={hasKeyframeAtCurrentTime ? "fill-current" : ""}
          />
          {hasKeyframeAtCurrentTime ? "At playhead" : "Add"}
        </button>
      </div>

      {/* Current value input with indicator */}
      {hasKeyframeAtCurrentTime && (
        <div className="flex items-center gap-1.5 text-[10px] text-yellow-400 bg-yellow-400/10 rounded px-2 py-1 mb-1">
          <Diamond size={8} className="fill-current" />
          <span>Editing keyframe at {formatTimecode(clip.startTime + clipTime)}</span>
        </div>
      )}
      
      {/* Show slider when on keyframe OR when no keyframes exist */}
      {(hasKeyframeAtCurrentTime || keyframes.length === 0) ? (
        <ValueInput
          value={currentValue}
          meta={meta}
          onChange={handleValueChange}
          onCommit={handleValueCommit}
          disabled={!isWithinClip}
        />
      ) : (
        /* When keyframes exist but not on one, show message */
        <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 bg-zinc-900 rounded px-3 py-3 border border-dashed border-zinc-700">
          <Diamond size={10} className="text-zinc-600" />
          <span>Click a keyframe below to edit</span>
        </div>
      )}

      {/* Keyframe list */}
      {keyframes.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-zinc-800 pt-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-600">
            <Diamond size={8} />
            <span>{keyframes.length} Keyframe{keyframes.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {keyframes.map((kf) => {
              const isAtThisKeyframe = Math.abs(kf.time - clipTime) < 0.017;
              return (
                <div
                  key={kf.id}
                  onClick={() => {
                    // Seek playhead to this keyframe's time (absolute time = clip start + keyframe time)
                    const setCurrentTime = useTimelineStore.getState().setCurrentTime;
                    setCurrentTime(clip.startTime + kf.time);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded px-2 py-1.5 text-xs cursor-pointer transition-colors",
                    isAtThisKeyframe
                      ? "bg-yellow-400/20 border border-yellow-400/50"
                      : "bg-zinc-900 hover:bg-zinc-800 border border-transparent"
                  )}
                >
                  {/* Timecode display */}
                  <input
                    type="text"
                    value={formatTimecode(clip.startTime + kf.time)}
                    className="w-20 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300 font-mono"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const absoluteTime = parseTimecode(e.target.value);
                      const newClipTime = absoluteTime - clip.startTime;
                      const clampedTime = Math.max(0, Math.min(clip.duration, newClipTime));
                      saveToHistory();
                      updateKeyframe(clip.id, kf.id, { time: clampedTime });
                    }}
                  />

                  {/* Easing */}
                  <select
                    value={kf.easing}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      saveToHistory();
                      updateKeyframe(clip.id, kf.id, {
                        easing: e.target.value as EasingType,
                      });
                    }}
                    className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-1 text-xs text-zinc-300"
                  >
                    <option value="linear">Linear</option>
                    <option value="ease-in">Ease In</option>
                    <option value="ease-out">Ease Out</option>
                    <option value="ease-in-out">Ease In/Out</option>
                  </select>

                  {/* Delete */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      saveToHistory();
                      removeKeyframe(clip.id, kf.id);
                    }}
                    className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Value input component based on type
interface ValueInputProps {
  value: KeyframeValue;
  meta: PropertyMeta;
  onChange: (value: KeyframeValue) => void;
  onCommit: (value: KeyframeValue) => void;
  disabled?: boolean;
}

function ValueInput({ value, meta, onChange, onCommit, disabled }: ValueInputProps) {
  if (meta.valueType === "number") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="range"
          value={value as number}
          min={meta.min ?? 0}
          max={meta.max ?? 1}
          step={meta.step ?? 0.01}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onMouseUp={(e) => onCommit(parseFloat((e.target as HTMLInputElement).value))}
          onTouchEnd={(e) => onCommit(parseFloat((e.target as HTMLInputElement).value))}
          className="flex-1 h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-blue-500 disabled:opacity-50"
        />
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={Math.round((value as number) * 100) / 100}
            min={meta.min}
            max={meta.max}
            step={meta.step}
            disabled={disabled}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            onBlur={(e) => onCommit(parseFloat(e.target.value) || 0)}
            className="w-14 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 disabled:opacity-50"
          />
          {meta.unit && (
            <span className="text-xs text-zinc-500">{meta.unit}</span>
          )}
        </div>
      </div>
    );
  }

  if (meta.valueType === "color") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value as string}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onCommit(e.target.value)}
          className="h-8 w-8 rounded border border-zinc-700 bg-transparent cursor-pointer disabled:opacity-50"
        />
        <input
          type="text"
          value={value as string}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onCommit(e.target.value)}
          className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 font-mono disabled:opacity-50"
          pattern="^#[0-9A-Fa-f]{6}$"
        />
      </div>
    );
  }

  if (meta.valueType === "position") {
    const pos = value as PositionValue;
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-500 w-4">X</span>
          <input
            type="number"
            value={Math.round(pos.x * 10) / 10}
            min={meta.min ?? 0}
            max={meta.max ?? 100}
            step={meta.step ?? 1}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...pos, x: parseFloat(e.target.value) || 0 })
            }
            onBlur={(e) =>
              onCommit({ ...pos, x: parseFloat(e.target.value) || 0 })
            }
            className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 disabled:opacity-50"
          />
          <span className="text-xs text-zinc-500">%</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-zinc-500 w-4">Y</span>
          <input
            type="number"
            value={Math.round(pos.y * 10) / 10}
            min={meta.min ?? 0}
            max={meta.max ?? 100}
            step={meta.step ?? 1}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...pos, y: parseFloat(e.target.value) || 0 })
            }
            onBlur={(e) =>
              onCommit({ ...pos, y: parseFloat(e.target.value) || 0 })
            }
            className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 disabled:opacity-50"
          />
          <span className="text-xs text-zinc-500">%</span>
        </div>
      </div>
    );
  }

  return null;
}
