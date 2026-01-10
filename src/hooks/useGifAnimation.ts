import { useState, useEffect, useRef, useMemo } from 'react';
import { parseGIF, decompressFrames } from 'gifuct-js';

interface GifFrame {
  imageData: ImageData;
  delay: number; // ms
}

interface ParsedGif {
  frames: GifFrame[];
  width: number;
  height: number;
  totalDuration: number; // Total loop duration in ms
}

interface UseGifAnimationResult {
  canvas: HTMLCanvasElement | null;
  isLoaded: boolean;
  error: string | null;
}

/**
 * Hook to load and animate a GIF file in sync with timeline playback.
 *
 * @param url - URL to the GIF file (or null if not animated)
 * @param _isPlaying - Whether the timeline is currently playing (unused, kept for API consistency)
 * @param clipTime - Current time relative to clip start (seconds)
 */
export function useGifAnimation(
  url: string | null,
  _isPlaying: boolean,
  clipTime: number
): UseGifAnimationResult {
  const [parsedGif, setParsedGif] = useState<ParsedGif | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastFrameIndexRef = useRef<number>(-1);

  // Load and parse GIF on mount or URL change
  useEffect(() => {
    if (!url) {
      setParsedGif(null);
      setIsLoaded(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const loadGif = async () => {
      try {
        setIsLoaded(false);
        setError(null);

        // Fetch the GIF file
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch GIF');

        const buffer = await response.arrayBuffer();

        // Parse GIF using gifuct-js
        const gif = parseGIF(buffer);
        const frames = decompressFrames(gif, true);

        if (cancelled) return;

        if (frames.length === 0) {
          throw new Error('No frames found in GIF');
        }

        // Get dimensions from first frame
        const width = frames[0].dims.width;
        const height = frames[0].dims.height;

        // Create canvas for rendering
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get canvas context');

        canvasRef.current = canvas;
        ctxRef.current = ctx;

        // Create a temporary canvas for compositing
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) throw new Error('Failed to get temp canvas context');

        // Convert frames to ImageData
        const processedFrames: GifFrame[] = [];
        let totalDuration = 0;

        for (const frame of frames) {
          // Handle disposal method
          if (frame.disposalType === 2) {
            // Restore to background
            tempCtx.clearRect(0, 0, width, height);
          }
          // disposalType 1 = do not dispose (keep previous frame)
          // disposalType 3 = restore to previous (not commonly used)

          // Create ImageData from frame patch
          const imageData = tempCtx.createImageData(frame.dims.width, frame.dims.height);
          imageData.data.set(frame.patch);

          // Draw frame patch at its position
          tempCtx.putImageData(
            imageData,
            frame.dims.left,
            frame.dims.top
          );

          // Capture the full frame
          const fullFrame = tempCtx.getImageData(0, 0, width, height);

          // Default delay is 100ms if not specified or too short
          const delay = frame.delay >= 20 ? frame.delay : 100;

          processedFrames.push({
            imageData: fullFrame,
            delay,
          });

          totalDuration += delay;
        }

        if (cancelled) return;

        setParsedGif({
          frames: processedFrames,
          width,
          height,
          totalDuration,
        });
        setIsLoaded(true);
        lastFrameIndexRef.current = -1; // Reset frame index

      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load GIF:', err);
          setError(err instanceof Error ? err.message : 'Failed to load GIF');
          setIsLoaded(false);
        }
      }
    };

    loadGif();

    return () => {
      cancelled = true;
    };
  }, [url]);

  // Calculate current frame index based on clip time
  const currentFrameIndex = useMemo(() => {
    if (!parsedGif || parsedGif.frames.length === 0) return 0;

    // Convert clipTime to ms
    const clipTimeMs = clipTime * 1000;

    // Handle looping: wrap around using modulo
    const loopTime = clipTimeMs >= 0
      ? clipTimeMs % parsedGif.totalDuration
      : 0;

    // Find which frame we should be on
    let accumulated = 0;
    for (let i = 0; i < parsedGif.frames.length; i++) {
      accumulated += parsedGif.frames[i].delay;
      if (loopTime < accumulated) {
        return i;
      }
    }

    // Fallback to last frame
    return parsedGif.frames.length - 1;
  }, [clipTime, parsedGif]);

  // Update canvas when frame changes
  useEffect(() => {
    if (!parsedGif || !canvasRef.current || !ctxRef.current) return;
    if (currentFrameIndex === lastFrameIndexRef.current) return;

    const frame = parsedGif.frames[currentFrameIndex];
    if (!frame) return;

    ctxRef.current.putImageData(frame.imageData, 0, 0);
    lastFrameIndexRef.current = currentFrameIndex;
  }, [currentFrameIndex, parsedGif]);

  return {
    canvas: canvasRef.current,
    isLoaded,
    error,
  };
}

/**
 * Hook to get GIF frame data for export purposes.
 * Returns raw frame data without managing playback.
 */
export function useGifFrames(url: string | null): {
  frames: GifFrame[];
  width: number;
  height: number;
  totalDuration: number;
  isLoaded: boolean;
  error: string | null;
} {
  const [parsedGif, setParsedGif] = useState<ParsedGif | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setParsedGif(null);
      setIsLoaded(false);
      return;
    }

    let cancelled = false;

    const loadGif = async () => {
      try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const gif = parseGIF(buffer);
        const frames = decompressFrames(gif, true);

        if (cancelled) return;

        if (frames.length === 0) {
          throw new Error('No frames in GIF');
        }

        const width = frames[0].dims.width;
        const height = frames[0].dims.height;

        // Create temp canvas for compositing
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) throw new Error('Canvas not supported');

        const processedFrames: GifFrame[] = [];
        let totalDuration = 0;

        for (const frame of frames) {
          if (frame.disposalType === 2) {
            tempCtx.clearRect(0, 0, width, height);
          }

          const imageData = tempCtx.createImageData(frame.dims.width, frame.dims.height);
          imageData.data.set(frame.patch);
          tempCtx.putImageData(imageData, frame.dims.left, frame.dims.top);

          const fullFrame = tempCtx.getImageData(0, 0, width, height);
          const delay = frame.delay >= 20 ? frame.delay : 100;

          processedFrames.push({ imageData: fullFrame, delay });
          totalDuration += delay;
        }

        if (cancelled) return;

        setParsedGif({
          frames: processedFrames,
          width,
          height,
          totalDuration,
        });
        setIsLoaded(true);

      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load GIF');
        }
      }
    };

    loadGif();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return {
    frames: parsedGif?.frames ?? [],
    width: parsedGif?.width ?? 0,
    height: parsedGif?.height ?? 0,
    totalDuration: parsedGif?.totalDuration ?? 0,
    isLoaded,
    error,
  };
}

/**
 * Get the frame index for a given time in a GIF animation.
 * Useful for export where we need to render specific frames.
 */
export function getGifFrameAtTime(
  frames: GifFrame[],
  totalDuration: number,
  timeMs: number
): number {
  if (frames.length === 0) return 0;

  const loopTime = timeMs >= 0 ? timeMs % totalDuration : 0;

  let accumulated = 0;
  for (let i = 0; i < frames.length; i++) {
    accumulated += frames[i].delay;
    if (loopTime < accumulated) {
      return i;
    }
  }

  return frames.length - 1;
}
