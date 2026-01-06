import { useEffect, useCallback } from "react";
import { KEYBOARD_SHORTCUTS } from "@/constants/timeline.constants";

interface UseKeyboardShortcutsOptions {
  onPlayPause?: () => void;
  onDelete?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onNudgeLeft?: () => void;
  onNudgeRight?: () => void;
  onSplit?: () => void;
  onMerge?: () => void;
  disabled?: boolean;
}

export function useKeyboardShortcuts({
  onPlayPause,
  onDelete,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onSelectAll,
  onDeselectAll,
  onNudgeLeft,
  onNudgeRight,
  onSplit,
  onMerge,
  disabled = false,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;

      // Ignore if focus is in an input element
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      const key = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Play/Pause (Space)
      if (key === KEYBOARD_SHORTCUTS.PLAY_PAUSE && !ctrl && !shift) {
        e.preventDefault();
        onPlayPause?.();
        return;
      }

      // Delete (Delete or Backspace)
      if ((KEYBOARD_SHORTCUTS.DELETE as readonly string[]).includes(key) && !ctrl && !shift) {
        e.preventDefault();
        onDelete?.();
        return;
      }

      // Undo (Ctrl/Cmd + Z)
      if (key.toLowerCase() === KEYBOARD_SHORTCUTS.UNDO && ctrl && !shift) {
        e.preventDefault();
        onUndo?.();
        return;
      }

      // Redo (Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y)
      if (
        (key.toLowerCase() === KEYBOARD_SHORTCUTS.UNDO && ctrl && shift) ||
        (key.toLowerCase() === KEYBOARD_SHORTCUTS.REDO && ctrl && !shift)
      ) {
        e.preventDefault();
        onRedo?.();
        return;
      }

      // Zoom In (= or +)
      if (key === KEYBOARD_SHORTCUTS.ZOOM_IN && !ctrl && !shift) {
        e.preventDefault();
        onZoomIn?.();
        return;
      }

      // Zoom Out (-)
      if (key === KEYBOARD_SHORTCUTS.ZOOM_OUT && !ctrl && !shift) {
        e.preventDefault();
        onZoomOut?.();
        return;
      }

      // Select All (Ctrl/Cmd + A)
      if (key.toLowerCase() === KEYBOARD_SHORTCUTS.SELECT_ALL && ctrl && !shift) {
        e.preventDefault();
        onSelectAll?.();
        return;
      }

      // Deselect (Escape)
      if (key === KEYBOARD_SHORTCUTS.DESELECT && !ctrl && !shift) {
        e.preventDefault();
        onDeselectAll?.();
        return;
      }

      // Nudge Left (Arrow Left)
      if (key === KEYBOARD_SHORTCUTS.NUDGE_LEFT && !ctrl && !shift) {
        onNudgeLeft?.();
        return;
      }

      // Nudge Right (Arrow Right)
      if (key === KEYBOARD_SHORTCUTS.NUDGE_RIGHT && !ctrl && !shift) {
        onNudgeRight?.();
        return;
      }

      // Split (S)
      if (key.toLowerCase() === KEYBOARD_SHORTCUTS.SPLIT && !ctrl && !shift) {
        e.preventDefault();
        onSplit?.();
        return;
      }

      // Merge (M)
      if (key.toLowerCase() === KEYBOARD_SHORTCUTS.MERGE && !ctrl && !shift) {
        e.preventDefault();
        onMerge?.();
        return;
      }
    },
    [
      disabled,
      onPlayPause,
      onDelete,
      onUndo,
      onRedo,
      onZoomIn,
      onZoomOut,
      onSelectAll,
      onDeselectAll,
      onNudgeLeft,
      onNudgeRight,
      onSplit,
      onMerge,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}
