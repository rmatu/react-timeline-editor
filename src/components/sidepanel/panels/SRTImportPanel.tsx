import { useCallback, useState } from 'react';
import { Upload, FileText, Trash2, Download, AlertCircle } from 'lucide-react';
import { useTimelineStore } from '@/stores/timelineStore';
import { createTrack } from '@/schemas';
import type { TextClip } from '@/schemas';

interface Subtitle {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
}

interface ImportedSRT {
  id: string;
  name: string;
  subtitles: Subtitle[];
}

export function SRTImportPanel() {
  const [srtFiles, setSrtFiles] = useState<ImportedSRT[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { tracks, addTrack, addClip } = useTimelineStore();

  const parseSRT = (content: string): Subtitle[] => {
    const subtitles: Subtitle[] = [];
    const blocks = content.trim().split(/\n\s*\n/);

    for (const block of blocks) {
      const lines = block.split('\n');
      if (lines.length < 3) continue;

      const index = parseInt(lines[0], 10);
      const timeLine = lines[1];
      const text = lines.slice(2).join('\n');

      // Parse time: 00:00:00,000 --> 00:00:05,000
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

      setSrtFiles((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: srtFile.name,
          subtitles,
        },
      ]);
    };
    reader.readAsText(srtFile);
  };

  const handleRemoveFile = useCallback((id: string) => {
    setSrtFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleImportToTimeline = useCallback(
    (srt: ImportedSRT) => {
      // Find or create a text track
      let textTrack = Array.from(tracks.values()).find((t) => t.type === 'text');

      if (!textTrack) {
        textTrack = createTrack({
          name: 'Subtitles',
          type: 'text',
          order: tracks.size,
        });
        addTrack(textTrack);
      }

      // Create text clips for each subtitle
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
    },
    [tracks, addTrack, addClip]
  );

  const formatTime = (seconds: number) => {
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
              ? 'border-orange-500 bg-orange-500/10 scale-[1.02]'
              : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50'
          }
        `}
      >
        <Upload
          size={24}
          className={isDragOver ? 'text-orange-400' : 'text-zinc-400'}
        />
        <span className="text-xs text-zinc-400 text-center">
          Drop .srt subtitle file here
        </span>
        <label className="mt-1 px-3 py-1.5 text-xs font-medium text-white bg-zinc-700 hover:bg-zinc-600 rounded cursor-pointer transition-colors">
          Browse Files
          <input
            type="file"
            accept=".srt"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-2 text-xs text-red-400 bg-red-500/10 rounded-lg">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* SRT File List */}
      <div className="flex-1 overflow-auto -mx-3 px-3">
        {srtFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-sm">
            <FileText size={32} className="mb-2 opacity-50" />
            <span>No subtitles imported</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {srtFiles.map((srt) => (
              <div
                key={srt.id}
                className="bg-zinc-800/50 rounded-lg overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center gap-2 p-2 bg-zinc-800">
                  <FileText size={16} className="text-orange-400" />
                  <span className="flex-1 text-sm text-white truncate">
                    {srt.name}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {srt.subtitles.length} subtitles
                  </span>
                  <button
                    onClick={() => handleRemoveFile(srt.id)}
                    title="Remove"
                    className="p-1 text-zinc-400 hover:text-red-400 hover:bg-zinc-700 rounded transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Preview (first 3 subtitles) */}
                <div className="p-2 space-y-1">
                  {srt.subtitles.slice(0, 3).map((sub) => (
                    <div key={sub.index} className="text-xs">
                      <span className="text-zinc-500">
                        [{formatTime(sub.startTime)} - {formatTime(sub.endTime)}]
                      </span>
                      <span className="ml-2 text-zinc-300 line-clamp-1">
                        {sub.text}
                      </span>
                    </div>
                  ))}
                  {srt.subtitles.length > 3 && (
                    <div className="text-xs text-zinc-500">
                      ... and {srt.subtitles.length - 3} more
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end p-2 border-t border-zinc-700">
                  <button
                    onClick={() => handleImportToTimeline(srt)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 rounded transition-colors"
                  >
                    <Download size={14} />
                    Import to Timeline
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
