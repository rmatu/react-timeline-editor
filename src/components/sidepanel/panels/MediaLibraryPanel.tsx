import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Upload, Film, Music, Trash2, Plus, GripVertical } from 'lucide-react';
import { useTimelineStore, type MediaItem } from '@/stores/timelineStore';
import { createTrack } from '@/schemas';
import type { VideoClip, AudioClip } from '@/schemas';
import { mediaStorage } from '@/services/persistence';

// Re-export MediaItem type for use elsewhere
export type { MediaItem } from '@/stores/timelineStore';

// Media item data for drag-and-drop
export interface MediaDragData {
  type: 'media-item';
  item: MediaItem;
}

export function MediaLibraryPanel() {
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Get media library from store (single source of truth)
  const mediaLibrary = useTimelineStore((s) => s.mediaLibrary);
  const addMediaItem = useTimelineStore((s) => s.addMediaItem);
  const removeMediaItem = useTimelineStore((s) => s.removeMediaItem);
  const updateMediaItem = useTimelineStore((s) => s.updateMediaItem);
  const tracks = useTimelineStore((s) => s.tracks);
  const addTrack = useTimelineStore((s) => s.addTrack);
  const addClip = useTimelineStore((s) => s.addClip);
  const currentTime = useTimelineStore((s) => s.currentTime);

  // Filter to only show video/audio items (not SRT)
  const mediaItems = useMemo(() => {
    return Array.from(mediaLibrary.values()).filter(
      (item) => item.type === 'video' || item.type === 'audio'
    );
  }, [mediaLibrary]);

  // Load metadata for items that don't have duration yet
  useEffect(() => {
    mediaItems.forEach((item) => {
      if (item.duration !== undefined) return; // Already has duration
      if (item.type !== 'video' && item.type !== 'audio') return;

      const element = document.createElement(
        item.type === 'video' ? 'video' : 'audio'
      ) as HTMLVideoElement | HTMLAudioElement;
      element.src = item.url;
      element.addEventListener('loadedmetadata', () => {
        updateMediaItem(item.id, { duration: element.duration });

        // Generate thumbnail for video
        if (item.type === 'video' && element instanceof HTMLVideoElement) {
          const video = element;
          video.currentTime = 1; // Seek to 1 second for thumbnail
          video.addEventListener('seeked', () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth / 4;
            canvas.height = video.videoHeight / 4;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
              updateMediaItem(item.id, { thumbnailUrl });
            }
          }, { once: true });
        }
      });
    });
  }, [mediaItems, updateMediaItem]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      processFiles(files);
      // Reset input
      e.target.value = '';
    },
    []
  );

  const processFiles = async (files: File[]) => {
    const mediaFiles = files.filter(
      (file) =>
        file.type.startsWith('video/') || file.type.startsWith('audio/')
    );

    for (const file of mediaFiles) {
      const id = crypto.randomUUID();

      // Save file to IndexedDB for persistence across reloads
      try {
        await mediaStorage.saveMedia(id, file, file.name);
      } catch (err) {
        console.error('Failed to save media to IndexedDB:', err);
      }

      const item: MediaItem = {
        id,
        name: file.name,
        type: file.type.startsWith('video/') ? 'video' : 'audio',
        url: URL.createObjectURL(file),
        storageId: id, // Reference to IndexedDB storage
      };
      addMediaItem(item);
    }
  };

  const handleRemoveItem = useCallback(async (id: string) => {
    const item = mediaLibrary.get(id);
    if (item) {
      if (item.url.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
      // Delete from IndexedDB
      if (item.storageId) {
        try {
          await mediaStorage.deleteMedia(item.storageId);
        } catch (err) {
          console.error('Failed to delete media from IndexedDB:', err);
        }
      }
    }
    removeMediaItem(id);
  }, [mediaLibrary, removeMediaItem]);

  const addMediaToTimeline = useCallback(
    (item: MediaItem, startTime: number = 0) => {
      if (item.type !== 'video' && item.type !== 'audio') return;
      
      // Find or create appropriate track
      const trackType = item.type;
      let track = Array.from(tracks.values()).find((t) => t.type === trackType);

      if (!track) {
        track = createTrack({
          name: `${trackType.charAt(0).toUpperCase() + trackType.slice(1)} Track`,
          type: trackType,
          order: tracks.size,
        });
        addTrack(track);
      }

      // Create clip with name
      const baseClip = {
        id: crypto.randomUUID(),
        trackId: track.id,
        type: item.type,
        name: item.name, // Store original filename
        startTime,
        duration: item.duration || 10,
        sourceStartTime: 0,
        sourceUrl: item.url,
        volume: 1,
        locked: false,
        muted: false,
      };

      if (item.type === 'video') {
        const videoClip: VideoClip = {
          ...baseClip,
          type: 'video',
          playbackRate: 1,
          maxDuration: item.duration,
          thumbnailUrl: item.thumbnailUrl,
        };
        addClip(videoClip);
      } else {
        const audioClip: AudioClip = {
          ...baseClip,
          type: 'audio',
          fadeIn: 0,
          fadeOut: 0,
        };
        addClip(audioClip);
      }
    },
    [tracks, addTrack, addClip]
  );

  const handleAddToTimeline = useCallback(
    (item: MediaItem) => {
      // Add at current playhead position
      addMediaToTimeline(item, currentTime);
    },
    [addMediaToTimeline, currentTime]
  );

  // Handle drag start for timeline drop
  const handleMediaDragStart = useCallback(
    (e: React.DragEvent, item: MediaItem) => {
      const dragData: MediaDragData = {
        type: 'media-item',
        item,
      };
      // Set multiple data types for compatibility
      e.dataTransfer.setData('application/json', JSON.stringify(dragData));
      e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'copy';
      // Set drag image
      if (e.currentTarget instanceof HTMLElement) {
        e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
      }
    },
    []
  );

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          flex flex-col items-center justify-center gap-2
          p-4 rounded-lg border-2 border-dashed
          transition-all duration-200 cursor-pointer
          ${
            isDragOver
              ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
              : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50'
          }
        `}
      >
        <Upload
          size={24}
          className={isDragOver ? 'text-blue-400' : 'text-zinc-400'}
        />
        <span className="text-xs text-zinc-400 text-center">
          Drop video or audio files here
        </span>
        <label className="mt-1 px-3 py-1.5 text-xs font-medium text-white bg-zinc-700 hover:bg-zinc-600 rounded cursor-pointer transition-colors">
          Browse Files
          <input
            type="file"
            accept="video/*,audio/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      </div>

      {/* Hint for drag to timeline */}
      {mediaItems.length > 0 && (
        <div className="text-xs text-zinc-500 text-center">
          Drag items to timeline or click + to add
        </div>
      )}

      {/* Media List */}
      <div className="flex-1 overflow-auto -mx-3 px-3">
        {mediaItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-sm">
            <Film size={32} className="mb-2 opacity-50" />
            <span>No media imported</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {mediaItems.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleMediaDragStart(e, item)}
                className="group flex items-center gap-2 p-2 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg transition-colors cursor-grab active:cursor-grabbing"
              >
                {/* Drag Handle */}
                <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors">
                  <GripVertical size={14} />
                </div>

                {/* Thumbnail or Icon */}
                <div
                  className={`
                    flex items-center justify-center w-10 h-10 rounded overflow-hidden flex-shrink-0
                    ${item.type === 'video' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}
                  `}
                >
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  ) : item.type === 'video' ? (
                    <Film size={18} />
                  ) : (
                    <Music size={18} />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{item.name}</div>
                  <div className="text-xs text-zinc-500">
                    {formatDuration(item.duration)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleAddToTimeline(item)}
                    title="Add to timeline"
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    title="Remove"
                    className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Export for use in timeline drop handler
export function parseMediaDragData(e: React.DragEvent): MediaDragData | null {
  try {
    // Try application/json first, then text/plain as fallback
    let data = e.dataTransfer.getData('application/json');
    if (!data) {
      data = e.dataTransfer.getData('text/plain');
    }
    if (!data) return null;
    
    const parsed = JSON.parse(data);
    if (parsed.type === 'media-item' && parsed.item) {
      return parsed as MediaDragData;
    }
    return null;
  } catch {
    return null;
  }
}
