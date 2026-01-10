import { memo, useCallback, useMemo } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import {
  TRANSITION_TYPES,
  DEFAULT_TRANSITION_DURATION,
  MIN_TRANSITION_DURATION,
  MAX_TRANSITION_DURATION,
} from "@/schemas/transition.schema";
import type { Clip, TransitionType, Transition } from "@/schemas";
import { getMaxTransitionDuration } from "@/utils/transitions";
import { Plus, Trash2 } from "lucide-react";

interface TransitionEditorProps {
  clip: Clip;
}

/**
 * UI component for editing clip transitions (in and out).
 * Allows adding, removing, and configuring transition effects.
 */
export const TransitionEditor = memo(function TransitionEditor({
  clip,
}: TransitionEditorProps) {
  const clips = useTimelineStore((state) => state.clips);
  const setClipTransition = useTimelineStore((state) => state.setClipTransition);
  const updateClipTransition = useTimelineStore((state) => state.updateClipTransition);
  const removeClipTransition = useTimelineStore((state) => state.removeClipTransition);
  const saveToHistory = useTimelineStore((state) => state.saveToHistory);

  // Calculate max durations for transitions
  const maxTransitionIn = useMemo(
    () => getMaxTransitionDuration(clip, "in", clips),
    [clip, clips]
  );
  const maxTransitionOut = useMemo(
    () => getMaxTransitionDuration(clip, "out", clips),
    [clip, clips]
  );

  const handleAddTransition = useCallback(
    (side: "in" | "out") => {
      setClipTransition(clip.id, side, "fade", DEFAULT_TRANSITION_DURATION);
    },
    [clip.id, setClipTransition]
  );

  const handleRemoveTransition = useCallback(
    (side: "in" | "out") => {
      removeClipTransition(clip.id, side);
    },
    [clip.id, removeClipTransition]
  );

  const handleTypeChange = useCallback(
    (side: "in" | "out", type: TransitionType) => {
      saveToHistory();
      updateClipTransition(clip.id, side, { type });
    },
    [clip.id, updateClipTransition, saveToHistory]
  );

  const handleDurationChange = useCallback(
    (side: "in" | "out", duration: number) => {
      updateClipTransition(clip.id, side, { duration });
    },
    [clip.id, updateClipTransition]
  );

  const handleDurationCommit = useCallback(
    (side: "in" | "out", duration: number) => {
      saveToHistory();
      updateClipTransition(clip.id, side, { duration });
    },
    [clip.id, updateClipTransition, saveToHistory]
  );

  // Group transitions by category for the select
  const groupedTransitions = useMemo(() => {
    const groups: Record<string, typeof TRANSITION_TYPES> = {};
    TRANSITION_TYPES.forEach((t) => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    });
    return groups;
  }, []);

  return (
    <div className="space-y-4">
      {/* Transition In */}
      <TransitionSideEditor
        label="Transition In"
        transition={clip.transitionIn}
        maxDuration={maxTransitionIn}
        groupedTransitions={groupedTransitions}
        onAdd={() => handleAddTransition("in")}
        onRemove={() => handleRemoveTransition("in")}
        onTypeChange={(type) => handleTypeChange("in", type)}
        onDurationChange={(d) => handleDurationChange("in", d)}
        onDurationCommit={(d) => handleDurationCommit("in", d)}
      />

      {/* Transition Out */}
      <TransitionSideEditor
        label="Transition Out"
        transition={clip.transitionOut}
        maxDuration={maxTransitionOut}
        groupedTransitions={groupedTransitions}
        onAdd={() => handleAddTransition("out")}
        onRemove={() => handleRemoveTransition("out")}
        onTypeChange={(type) => handleTypeChange("out", type)}
        onDurationChange={(d) => handleDurationChange("out", d)}
        onDurationCommit={(d) => handleDurationCommit("out", d)}
      />
    </div>
  );
});

interface TransitionSideEditorProps {
  label: string;
  transition?: Transition;
  maxDuration: number;
  groupedTransitions: Record<string, typeof TRANSITION_TYPES>;
  onAdd: () => void;
  onRemove: () => void;
  onTypeChange: (type: TransitionType) => void;
  onDurationChange: (duration: number) => void;
  onDurationCommit: (duration: number) => void;
}

const TransitionSideEditor = memo(function TransitionSideEditor({
  label,
  transition,
  maxDuration,
  groupedTransitions,
  onAdd,
  onRemove,
  onTypeChange,
  onDurationChange,
  onDurationCommit,
}: TransitionSideEditorProps) {
  if (!transition) {
    // No transition - show add button
    return (
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-400">{label}</label>
        <button
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-dashed border-zinc-600 hover:border-zinc-500 rounded transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add {label}
        </button>
      </div>
    );
  }

  // Has transition - show editor
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-zinc-400">{label}</label>
        <button
          onClick={onRemove}
          className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
          title="Remove transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Transition type select */}
      <select
        value={transition.type}
        onChange={(e) => onTypeChange(e.target.value as TransitionType)}
        className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
      >
        {Object.entries(groupedTransitions).map(([category, types]) => (
          <optgroup key={category} label={category.charAt(0).toUpperCase() + category.slice(1)}>
            {types.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Duration slider */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span>Duration</span>
          <span>{transition.duration.toFixed(2)}s</span>
        </div>
        <input
          type="range"
          min={MIN_TRANSITION_DURATION}
          max={Math.min(maxDuration, MAX_TRANSITION_DURATION)}
          step={0.1}
          value={transition.duration}
          onChange={(e) => onDurationChange(parseFloat(e.target.value))}
          onMouseUp={(e) => onDurationCommit(parseFloat((e.target as HTMLInputElement).value))}
          onTouchEnd={(e) => onDurationCommit(parseFloat((e.target as HTMLInputElement).value))}
          className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
      </div>

      {/* Easing select */}
      <div className="space-y-1">
        <label className="text-[10px] text-zinc-500">Easing</label>
        <select
          value={transition.easing}
          onChange={() => onTypeChange(transition.type)} // Keep type same but we'd update easing
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white focus:border-blue-500 focus:outline-none"
          disabled // For now, easing is set automatically
        >
          <option value="linear">Linear</option>
          <option value="ease-in">Ease In</option>
          <option value="ease-out">Ease Out</option>
          <option value="ease-in-out">Ease In/Out</option>
        </select>
      </div>
    </div>
  );
});
