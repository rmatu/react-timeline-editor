import { useState, useEffect, useRef } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { VideoProperties } from "./VideoProperties";
import { AudioProperties } from "./AudioProperties";
import { TextProperties } from "./TextProperties";
import { StickerProperties } from "./StickerProperties";
import { BackgroundProperties } from "./BackgroundProperties";
import { X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const ContextPanel = () => {
  const selectedClipIds = useTimelineStore((state) => state.selectedClipIds);
  const isBackgroundSelected = useTimelineStore((state) => state.isBackgroundSelected);
  const clips = useTimelineStore((state) => state.clips);

  // Panel stays open until explicitly closed
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  // Track the clip being edited (persists even when deselected)
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const prevSelectedRef = useRef<string[]>([]);

  // Open panel when a clip is selected, update editing clip
  useEffect(() => {
    if (selectedClipIds.length > 0) {
      // New selection - open panel and set editing clip
      setIsPanelOpen(true);
      setEditingClipId(selectedClipIds[0]);
    } else if (isBackgroundSelected) {
       setIsPanelOpen(true);
       setEditingClipId(null);
    }
    prevSelectedRef.current = selectedClipIds;
  }, [selectedClipIds, isBackgroundSelected]);

  const handleClose = () => {
    setIsPanelOpen(false);
    setEditingClipId(null);
  };

  // Get the clip being edited (may differ from current selection)
  const clip = editingClipId ? clips.get(editingClipId) : undefined;

  // If the editing clip was deleted, close the panel
  useEffect(() => {
    if (editingClipId && !clips.has(editingClipId)) {
      setIsPanelOpen(false);
      setEditingClipId(null);
    }
  }, [clips, editingClipId]);

  // Determine title based on the clip being edited
  const getTitle = () => {
    if (clip) {
      return `${clip.type.charAt(0).toUpperCase() + clip.type.slice(1)} Properties`;
    }
    if (isBackgroundSelected) {
      return "Video Background";
    }
    return "Properties";
  };

  return (
    <Sheet open={isPanelOpen} modal={false}>
      <SheetContent
        side="right"
        className="top-14 h-[calc(100%-3.5rem)] w-80 bg-zinc-900 border-l border-zinc-700 p-0 rounded-tl-xl shadow-2xl flex flex-col focus:outline-none"
        showOverlay={false}
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Modal-style header with close button */}
        <SheetHeader className="border-b border-zinc-800 px-4 py-3 flex flex-row items-center justify-between shrink-0">
          <SheetTitle className="text-sm font-semibold text-zinc-100">
            {getTitle()}
          </SheetTitle>
          <button
            onClick={handleClose}
            className="flex items-center justify-center h-7 w-7 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-zinc-100"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            {clip ? (
              <>
                {clip.type === "video" && <VideoProperties clip={clip} />}
                {clip.type === "audio" && <AudioProperties clip={clip} />}
                {clip.type === "text" && <TextProperties clip={clip} />}
                {clip.type === "sticker" && <StickerProperties clip={clip} />}
              </>
            ) : isBackgroundSelected ? (
              <BackgroundProperties />
            ) : null}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
