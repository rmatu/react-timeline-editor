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
    return keyframes.some((kf) => Math.abs(kf.time - clipTime) < 0.05);
  }, [keyframes, clipTime]);

  const handleAddKeyframe = () => {
    if (!isWithinClip) return;
    addKeyframeAtCurrentTime(clip.id, property, currentValue);
  };

  const handleValueChange = (value: KeyframeValue) => {
    // If there's a keyframe at current time, update it
    const existingKf = keyframes.find(
      (kf) => Math.abs(kf.time - clipTime) < 0.05
    );
    if (existingKf) {
      updateKeyframe(clip.id, existingKf.id, { value });
    } else if (isWithinClip) {
      // Add new keyframe at current time with the new value
      addKeyframeAtCurrentTime(clip.id, property, value);
    }
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

      {/* Current value input */}
      <ValueInput
        value={currentValue}
        meta={meta}
        onChange={handleValueChange}
        disabled={!isWithinClip}
      />

      {/* Keyframe list */}
      {keyframes.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-zinc-800 pt-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-600">
            <Diamond size={8} />
            <span>{keyframes.length} Keyframe{keyframes.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {keyframes.map((kf) => (
              <div
                key={kf.id}
                className="flex items-center gap-2 rounded bg-zinc-900 px-2 py-1.5 text-xs"
              >
                {/* Time */}
                <input
                  type="number"
                  value={Math.round(kf.time * 100) / 100}
                  step={0.1}
                  min={0}
                  max={clip.duration}
                  className="w-14 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300"
                  onChange={(e) => {
                    const newTime = Math.max(
                      0,
                      Math.min(clip.duration, parseFloat(e.target.value) || 0)
                    );
                    updateKeyframe(clip.id, kf.id, { time: newTime });
                  }}
                />
                <span className="text-zinc-500 text-[10px]">s</span>

                {/* Easing */}
                <select
                  value={kf.easing}
                  onChange={(e) =>
                    updateKeyframe(clip.id, kf.id, {
                      easing: e.target.value as EasingType,
                    })
                  }
                  className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-1 py-0.5 text-[10px] text-zinc-300"
                >
                  <option value="linear">Linear</option>
                  <option value="ease-in">Ease In</option>
                  <option value="ease-out">Ease Out</option>
                  <option value="ease-in-out">Ease In/Out</option>
                </select>

                {/* Delete */}
                <button
                  onClick={() => removeKeyframe(clip.id, kf.id)}
                  className="text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
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
  disabled?: boolean;
}

function ValueInput({ value, meta, onChange, disabled }: ValueInputProps) {
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
          className="h-8 w-8 rounded border border-zinc-700 bg-transparent cursor-pointer disabled:opacity-50"
        />
        <input
          type="text"
          value={value as string}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
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
            className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 disabled:opacity-50"
          />
          <span className="text-xs text-zinc-500">%</span>
        </div>
      </div>
    );
  }

  return null;
}
