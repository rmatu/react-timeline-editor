import React, { useCallback, useState, useMemo } from 'react';
import { Upload, FileText, Trash2, Download, AlertCircle, Play, ChevronDown, ChevronRight } from 'lucide-react';
import { useTimelineStore, type MediaItem, type Subtitle } from '@/stores/timelineStore';
import { createTrack } from '@/schemas';
import type { TextClip } from '@/schemas';

// Re-export types
export type { Subtitle } from '@/stores/timelineStore';

export function SRTImportPanel() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImportSection, setShowImportSection] = useState(true);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  
  // Get data from store
  const mediaLibrary = useTimelineStore((s) => s.mediaLibrary);
  const clips = useTimelineStore((s) => s.clips);
  const addMediaItem = useTimelineStore((s) => s.addMediaItem);
  const removeMediaItem = useTimelineStore((s) => s.removeMediaItem);
  const updateClip = useTimelineStore((s) => s.updateClip);
  const removeClip = useTimelineStore((s) => s.removeClip);
  const tracks = useTimelineStore((s) => s.tracks);
  const addTrack = useTimelineStore((s) => s.addTrack);
  const addClip = useTimelineStore((s) => s.addClip);
  const setCurrentTime = useTimelineStore((s) => s.setCurrentTime);
  const selectClip = useTimelineStore((s) => s.selectClip);

  // Get text clips from timeline (sorted by startTime) - these ARE the subtitles on the timeline
  const textClips = useMemo(() => {
    return Array.from(clips.values())
      .filter((clip): clip is TextClip => clip.type === 'text')
      .sort((a, b) => a.startTime - b.startTime);
  }, [clips]);

  // Filter to only show SRT items (for import)
  const srtFiles = useMemo(() => {
    return Array.from(mediaLibrary.values()).filter(
      (item) => item.type === 'srt'
    );
  }, [mediaLibrary]);

  const parseSRT = (content: string): Subtitle[] => {
    const subtitles: Subtitle[] = [];
    const blocks = content.trim().split(/\n\s*\n/);

    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length < 3) continue;

      const index = parseInt(lines[0], 10);
      const timeLine = lines[1];
      const text = lines.slice(2).join('\n');

      const timeMatch = timeLine.match(
        /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/
      );

      if (timeMatch) {
        const startTime =
          parseInt(timeMatch[1]) * 3600 +
          parseInt(timeMatch[2]) * 60 +
          parseInt(timeMatch[3]) +
          parseInt(timeMatch[4]) / 1000;

        const endTime =
          parseInt(timeMatch[5]) * 3600 +
          parseInt(timeMatch[6]) * 60 +
          parseInt(timeMatch[7]) +
          parseInt(timeMatch[8]) / 1000;

        subtitles.push({
          index,
          startTime,
          endTime,
          text: text.trim(),
        });
      }
    }

    return subtitles;
  };

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
    setError(null);

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const files = e.target.files ? Array.from(e.target.files) : [];
      processFiles(files);
      e.target.value = '';
    },
    []
  );

  const processFiles = (files: File[]) => {
    const srtFile = files.find(
      (f) => f.name.endsWith('.srt') || f.type === 'application/x-subrip'
    );

    if (!srtFile) {
      setError('Please select a valid .srt file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const subtitles = parseSRT(content);

      if (subtitles.length === 0) {
        setError('No valid subtitles found in file');
        return;
      }

      const id = crypto.randomUUID();
      const mediaItem: MediaItem = {
        id,
        name: srtFile.name,
        type: 'srt',
        url: '',
        subtitles,
      };
      addMediaItem(mediaItem);
    };
    reader.readAsText(srtFile);
  };

  const handleRemoveSrtFile = useCallback((id: string) => {
    removeMediaItem(id);
  }, [removeMediaItem]);

  // Update text clip directly on the timeline
  const handleUpdateClipText = useCallback((clipId: string, newContent: string) => {
    updateClip(clipId, { content: newContent });
  }, [updateClip]);

  // Delete text clip from timeline
  const handleDeleteClip = useCallback((clipId: string) => {
    removeClip(clipId);
    if (selectedClipId === clipId) {
      setSelectedClipId(null);
    }
  }, [removeClip, selectedClipId]);

  // Jump to clip and select it
  const handlePlayClip = useCallback((clip: TextClip) => {
    setCurrentTime(clip.startTime);
    selectClip(clip.id);
    setSelectedClipId(clip.id);
  }, [setCurrentTime, selectClip]);

  const handleImportToTimeline = useCallback(
    (srt: MediaItem) => {
      if (!srt.subtitles) return;
      
      let textTrack = Array.from(tracks.values()).find((t) => t.type === 'text');

      if (!textTrack) {
        textTrack = createTrack({
          name: 'Subtitles',
          type: 'text',
          order: tracks.size,
        });
        addTrack(textTrack);
      }

      for (const sub of srt.subtitles) {
        const textClip: TextClip = {
          id: crypto.randomUUID(),
          trackId: textTrack.id,
          type: 'text',
          startTime: sub.startTime,
          duration: sub.endTime - sub.startTime,
          sourceStartTime: 0,
          content: sub.text,
          fontFamily: 'Inter',
          fontSize: 32,
          fontWeight: 'normal',
          color: '#ffffff',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          textAlign: 'center',
          position: { x: 50, y: 85 },
          animation: 'none',
          locked: false,
          muted: false,
        };
        addClip(textClip);
      }
      
      // Remove SRT from media library after import
      removeMediaItem(srt.id);
    },
    [tracks, addTrack, addClip, removeMediaItem]
  );

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Import Section - Collapsible */}
      <div className="flex-shrink-0 p-3 border-b border-zinc-800">
        <button
          onClick={() => setShowImportSection(!showImportSection)}
          className="flex items-center gap-2 w-full text-left text-xs font-medium text-zinc-400 hover:text-white transition-colors"
        >
          {showImportSection ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Import SRT
        </button>
        
        {showImportSection && (
          <div className="mt-2">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                flex flex-col items-center justify-center gap-2
                p-3 rounded-lg border-2 border-dashed
                transition-all duration-200 cursor-pointer
                ${
                  isDragOver
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50'
                }
              `}
            >
              <Upload size={20} className={isDragOver ? 'text-orange-400' : 'text-zinc-400'} />
              <span className="text-xs text-zinc-400 text-center">Drop .srt file here</span>
              <label className="px-2 py-1 text-xs font-medium text-white bg-zinc-700 hover:bg-zinc-600 rounded cursor-pointer transition-colors">
                Browse
                <input type="file" accept=".srt" onChange={handleFileSelect} className="hidden" />
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-2 mt-2 p-2 text-xs text-red-400 bg-red-500/10 rounded-lg">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            {/* Pending SRT files to import */}
            {srtFiles.map((srt) => (
              <div key={srt.id} className="mt-2 p-2 bg-zinc-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-orange-400" />
                  <span className="flex-1 text-xs text-white truncate">{srt.name}</span>
                  <span className="text-xs text-zinc-500">{srt.subtitles?.length || 0}</span>
                  <button
                    onClick={() => handleRemoveSrtFile(srt.id)}
                    className="p-1 text-zinc-400 hover:text-red-400 rounded"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <button
                  onClick={() => handleImportToTimeline(srt)}
                  className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 rounded transition-colors"
                >
                  <Download size={12} />
                  Import to Timeline
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline Text Clips - Editable List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {textClips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-sm p-4">
            <FileText size={32} className="mb-2 opacity-50" />
            <span className="text-center">No subtitles on timeline</span>
            <span className="text-xs text-zinc-600 mt-1">Import an SRT file above</span>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {textClips.map((clip) => (
              <div 
                key={clip.id}
                className={`
                  group p-3 hover:bg-zinc-800/50 transition-colors cursor-pointer
                  ${selectedClipId === clip.id ? 'bg-orange-500/10 border-l-2 border-orange-500' : 'border-l-2 border-transparent'}
                `}
                onClick={() => {
                  setSelectedClipId(clip.id);
                  selectClip(clip.id);
                }}
              >
                {/* Timecode row with actions */}
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs text-zinc-500 font-mono">
                    {formatTime(clip.startTime)} - {formatTime(clip.startTime + clip.duration)}
                  </span>
                  <div className="flex-1" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayClip(clip);
                    }}
                    title="Jump to this subtitle"
                    className="p-1 text-zinc-500 hover:text-orange-400 hover:bg-zinc-700 rounded opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Play size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClip(clip.id);
                    }}
                    title="Delete subtitle"
                    className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-700 rounded opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                
                {/* Editable text - directly updates the timeline clip */}
                <textarea
                  value={clip.content}
                  onChange={(e) => handleUpdateClipText(clip.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-zinc-800/50 hover:bg-zinc-700/50 focus:bg-zinc-700 text-sm text-zinc-200 resize-none focus:outline-none rounded px-2 py-1.5 transition-colors"
                  style={{ fieldSizing: 'content' } as React.CSSProperties}
                  placeholder="Enter subtitle text..."
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer with count */}
      {textClips.length > 0 && (
        <div className="flex-shrink-0 px-3 py-2 border-t border-zinc-800 text-xs text-zinc-500">
          {textClips.length} subtitle{textClips.length !== 1 ? 's' : ''} on timeline
        </div>
      )}

      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
