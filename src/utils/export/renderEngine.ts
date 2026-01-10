/**
 * Unified Render Engine for Video Export
 *
 * Mirrors VideoPreview.tsx rendering logic to ensure WYSIWYG export.
 * Renders all layers (video, text, stickers) to canvas for frame-accurate export.
 * Supports keyframe animations via the same interpolation logic as preview.
 */

import type { Clip, Track, VideoClip, TextClip, StickerClip } from "@/schemas";
import { getAnimatedPropertiesAtTime } from "@/utils/keyframes";
import { parseGIF, decompressFrames } from "gifuct-js";

// Sticker size constraints (matches preview CSS max-w-[300px] max-h-[300px])
// Preview uses 300px max - to match WYSIWYG, we scale based on typical preview container width
// For a 9:16 video in a typical preview viewport, the container is ~420px wide
// So the sticker ratio is 300/420 ≈ 71% of the short dimension
const STICKER_PREVIEW_MAX_SIZE = 300;
const STICKER_PREVIEW_CONTAINER_WIDTH = 420;

// GIF frame data for export
interface GifFrameData {
  frames: ImageData[];
  delays: number[];
  totalDuration: number;
  width: number;
  height: number;
}

// ============================================================================
// Types
// ============================================================================

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  time: number;
  tracks: Map<string, Track>;
  clips: Map<string, Clip>;
}

export interface VideoResources {
  videoElements: Map<string, HTMLVideoElement>;
  stickerImages: Map<string, HTMLImageElement>;
  gifFrames: Map<string, GifFrameData>;
}

export interface RenderEngineOptions {
  width: number;
  height: number;
  tracks: Map<string, Track>;
  clips: Map<string, Clip>;
}

// ============================================================================
// Render Engine
// ============================================================================

export class RenderEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private tracks: Map<string, Track>;
  private clips: Map<string, Clip>;
  private resources: VideoResources | null = null;

  constructor(options: RenderEngineOptions) {
    // Ensure even dimensions for video codecs
    this.width = options.width % 2 === 0 ? options.width : options.width - 1;
    this.height = options.height % 2 === 0 ? options.height : options.height - 1;
    this.tracks = options.tracks;
    this.clips = options.clips;

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext("2d")!;
  }

  /**
   * Pre-load all media assets (videos, images) before rendering
   */
  async loadResources(): Promise<void> {
    const videoElements = new Map<string, HTMLVideoElement>();
    const stickerImages = new Map<string, HTMLImageElement>();
    const gifFrames = new Map<string, GifFrameData>();

    // Load video clips
    const videoClips = this.getClipsByType<VideoClip>("video");
    await Promise.all(
      videoClips.map(async (clip) => {
        const vid = document.createElement("video");
        vid.crossOrigin = "anonymous";
        vid.src = clip.sourceUrl;
        vid.muted = true;
        vid.preload = "auto";
        await new Promise<void>((resolve, reject) => {
          vid.onloadeddata = () => resolve();
          vid.onerror = (e) => reject(e);
        });
        videoElements.set(clip.id, vid);
      })
    );

    // Load sticker images (and extract GIF frames for animated stickers)
    const stickerClips = this.getClipsByType<StickerClip>("sticker");
    await Promise.all(
      stickerClips.map(async (clip) => {
        // For animated GIFs, extract frames
        if (clip.isAnimated) {
          try {
            const frameData = await this.extractGifFrames(clip.assetUrl);
            gifFrames.set(clip.id, frameData);
          } catch (err) {
            console.error(`Failed to extract GIF frames for clip ${clip.id}:`, err);
            // Fallback: try to load as static image
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = clip.assetUrl;
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error(`Failed to load sticker: ${clip.assetUrl}`));
            });
            stickerImages.set(clip.id, img);
          }
        } else {
          // Static image
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = clip.assetUrl;
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error(`Failed to load sticker: ${clip.assetUrl}`));
          });
          stickerImages.set(clip.id, img);
        }
      })
    );

    this.resources = { videoElements, stickerImages, gifFrames };
  }

  /**
   * Extract frames from a GIF file for animation during export
   */
  private async extractGifFrames(url: string): Promise<GifFrameData> {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();

    const gif = parseGIF(buffer);
    const frames = decompressFrames(gif, true);

    if (frames.length === 0) {
      throw new Error("No frames found in GIF");
    }

    const width = frames[0].dims.width;
    const height = frames[0].dims.height;

    // Create temp canvas for compositing frames
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) throw new Error("Failed to get canvas context");

    const processedFrames: ImageData[] = [];
    const delays: number[] = [];
    let totalDuration = 0;

    for (const frame of frames) {
      // Handle disposal method
      if (frame.disposalType === 2) {
        tempCtx.clearRect(0, 0, width, height);
      }

      // Create ImageData from frame patch
      const imageData = tempCtx.createImageData(frame.dims.width, frame.dims.height);
      imageData.data.set(frame.patch);

      // Draw frame patch at its position
      tempCtx.putImageData(imageData, frame.dims.left, frame.dims.top);

      // Capture the full frame
      const fullFrame = tempCtx.getImageData(0, 0, width, height);
      processedFrames.push(fullFrame);

      // Default delay is 100ms if not specified or too short
      const delay = frame.delay >= 20 ? frame.delay : 100;
      delays.push(delay);
      totalDuration += delay;
    }

    return {
      frames: processedFrames,
      delays,
      totalDuration,
      width,
      height,
    };
  }

  /**
   * Render a single frame at the given time
   */
  async renderFrame(time: number): Promise<HTMLCanvasElement> {
    if (!this.resources) {
      throw new Error("Resources not loaded. Call loadResources() first.");
    }

    const ctx = this.ctx;

    // 1. Clear canvas with black background
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, this.width, this.height);

    // 2. Render layers in order (painter's algorithm: bottom to top)
    // Video clips are rendered sorted by track order (higher order = on top)
    await this.renderVideoLayer(time);

    // 3. Render sticker clips
    this.renderStickerLayer(time);

    // 4. Render text clips (always on top)
    this.renderTextLayer(time);

    return this.canvas;
  }

  /**
   * Get canvas as Blob for encoding
   */
  async getFrameBlob(quality = 0.8): Promise<Blob | null> {
    return new Promise((resolve) => this.canvas.toBlob(resolve, "image/jpeg", quality));
  }

  // ==========================================================================
  // Layer Renderers
  // ==========================================================================

  private async renderVideoLayer(time: number): Promise<void> {
    const videoClips = this.getActiveClips<VideoClip>("video", time);

    // Sort by track order (lower order = bottom, higher order = top)
    // This matches VideoPreview.tsx: renders in order so later items overlay earlier
    videoClips.sort((a, b) => {
      const trackA = this.tracks.get(a.trackId);
      const trackB = this.tracks.get(b.trackId);
      // Higher order = later in render = on top
      return (trackB?.order ?? 999) - (trackA?.order ?? 999);
    });

    for (const clip of videoClips) {
      const vid = this.resources!.videoElements.get(clip.id);
      if (!vid) continue;

      // Get animated properties for keyframe animations
      const animated = getAnimatedPropertiesAtTime(clip, time);

      // Calculate seek time with playback rate
      const seekTime = clip.sourceStartTime + (time - clip.startTime) * clip.playbackRate;

      // Always seek to ensure we get the correct frame
      // Use requestVideoFrameCallback if available for frame-accurate timing
      await this.seekVideoToTime(vid, seekTime);

      // Calculate base video dimensions (contain mode)
      const baseScale = Math.min(this.width / vid.videoWidth, this.height / vid.videoHeight);
      const w = vid.videoWidth * baseScale;
      const h = vid.videoHeight * baseScale;

      // Position based on animated position (percentage to pixels, centered on point)
      const x = (animated.position.x / 100) * this.width;
      const y = (animated.position.y / 100) * this.height;

      // Apply keyframe animations (opacity, scale, rotation)
      this.ctx.save();
      this.ctx.globalAlpha = animated.opacity;

      // Apply transforms around video position (center of video at position)
      this.ctx.translate(x, y);
      this.ctx.scale(animated.scale, animated.scale);
      this.ctx.rotate((animated.rotation * Math.PI) / 180);

      // Draw video centered on the transformed origin
      this.ctx.drawImage(vid, -w / 2, -h / 2, w, h);
      this.ctx.restore();
    }
  }

  /**
   * Seek video to exact time and wait for frame to be ready
   */
  private async seekVideoToTime(video: HTMLVideoElement, time: number): Promise<void> {
    // Store reference before 'in' check to avoid TypeScript narrowing
    const vid = video;
    const hasRVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

    return new Promise<void>((resolve) => {
      if (hasRVFC) {
        // Use requestVideoFrameCallback (Chrome 83+) for frame-accurate timing
        vid.currentTime = time;
        (vid as any).requestVideoFrameCallback(() => {
          resolve();
        });
      } else {
        // Fallback: use seeked event
        const onSeeked = () => {
          vid.removeEventListener("seeked", onSeeked);
          // Small delay to ensure frame is decoded
          setTimeout(resolve, 0);
        };
        vid.addEventListener("seeked", onSeeked, { once: true });
        vid.currentTime = time;
      }
    });
  }

  private renderStickerLayer(time: number): void {
    const stickerClips = this.getActiveClips<StickerClip>("sticker", time);

    // Calculate max sticker dimension to match preview's visual proportion
    // Preview: 300px sticker in ~420px container = 71.4% of container width
    // Export: Scale proportionally to maintain same visual ratio
    // For 1080x1920 export: 300 * (1080/420) = 771px
    const scaleFactor = Math.min(this.width, this.height) / STICKER_PREVIEW_CONTAINER_WIDTH;
    const maxStickerDimension = STICKER_PREVIEW_MAX_SIZE * scaleFactor;

    // Debug: log first frame only
    if (time < 0.1) {
      console.log('[RenderEngine] Sticker rendering debug:', {
        canvasWidth: this.width,
        canvasHeight: this.height,
        scaleFactor,
        maxStickerDimension,
        stickerCount: stickerClips.length,
      });
    }

    for (const clip of stickerClips) {
      // Get animated properties for keyframe animations
      const animated = getAnimatedPropertiesAtTime(clip, time);

      const ctx = this.ctx;
      ctx.save();

      // Position (use animated position, percentage to pixels, centered)
      const x = (animated.position.x / 100) * this.width;
      const y = (animated.position.y / 100) * this.height;

      // Debug: log sticker details for first frame
      if (time < 0.1) {
        console.log('[RenderEngine] Sticker:', {
          id: clip.id.slice(0, 8),
          positionPercent: animated.position,
          positionPixels: { x, y },
          scale: animated.scale,
          rotation: animated.rotation,
        });
      }

      ctx.translate(x, y);
      ctx.rotate((animated.rotation * Math.PI) / 180);
      ctx.scale(animated.scale, animated.scale);
      ctx.globalAlpha = animated.opacity;

      // Check if this is an animated GIF with extracted frames
      const gifData = this.resources!.gifFrames.get(clip.id);
      if (gifData && clip.isAnimated) {
        // Calculate constrained dimensions for GIF (matching preview max-w/max-h)
        let w = gifData.width;
        let h = gifData.height;
        if (w > maxStickerDimension || h > maxStickerDimension) {
          const constrainScale = Math.min(maxStickerDimension / w, maxStickerDimension / h);
          w *= constrainScale;
          h *= constrainScale;
        }

        // Calculate which frame to show based on clip-relative time
        const clipTimeMs = (time - clip.startTime) * 1000;
        const loopTime = clipTimeMs >= 0 ? clipTimeMs % gifData.totalDuration : 0;

        // Find the frame index based on accumulated delays
        let frameIndex = 0;
        let accumulated = 0;
        for (let i = 0; i < gifData.delays.length; i++) {
          accumulated += gifData.delays[i];
          if (loopTime < accumulated) {
            frameIndex = i;
            break;
          }
        }

        // Draw the GIF frame at constrained dimensions
        const frameData = gifData.frames[frameIndex];
        if (frameData) {
          // Create a temp canvas to convert ImageData to drawable image
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = gifData.width;
          tempCanvas.height = gifData.height;
          const tempCtx = tempCanvas.getContext("2d");
          if (tempCtx) {
            tempCtx.putImageData(frameData, 0, 0);
            ctx.drawImage(tempCanvas, -w / 2, -h / 2, w, h);
          }
        }
      } else {
        // Static image with constrained dimensions (matching preview max-w/max-h)
        const img = this.resources!.stickerImages.get(clip.id);
        if (img) {
          let w = img.width;
          let h = img.height;
          if (w > maxStickerDimension || h > maxStickerDimension) {
            const constrainScale = Math.min(maxStickerDimension / w, maxStickerDimension / h);
            w *= constrainScale;
            h *= constrainScale;
          }
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        }
      }

      ctx.restore();
    }
  }

  /**
   * Wrap text into lines that fit within maxWidth.
   * If no maxWidth is set, returns a single line with the full text.
   */
  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number | undefined
  ): string[] {
    // First, split by explicit newlines
    const paragraphs = text.split("\n");

    // If no maxWidth, just return paragraphs as-is
    if (!maxWidth) {
      return paragraphs;
    }

    const lines: string[] = [];

    for (const paragraph of paragraphs) {
      if (!paragraph) {
        // Empty line (explicit newline)
        lines.push("");
        continue;
      }

      const words = paragraph.split(" ");
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
          // Line is too long, push current and start new
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      // Push remaining text
      if (currentLine) {
        lines.push(currentLine);
      }
    }

    return lines.length > 0 ? lines : [""];
  }

  private renderTextLayer(time: number): void {
    const textClips = this.getActiveClips<TextClip>("text", time);

    for (const clip of textClips) {
      // Get animated properties for keyframe animations
      const animated = getAnimatedPropertiesAtTime(clip, time);

      const ctx = this.ctx;

      // Position (use animated position, percentage to pixels)
      // The preview uses transform: translate(-50%, -50%) to center the text box at position
      const x = (animated.position.x / 100) * this.width;
      const y = (animated.position.y / 100) * this.height;

      ctx.save();

      // Apply keyframe animations (opacity, scale, rotation)
      ctx.globalAlpha = animated.opacity;
      ctx.translate(x, y);
      ctx.scale(animated.scale, animated.scale);
      ctx.rotate((animated.rotation * Math.PI) / 180);

      // Use animated fontSize and color
      const fontSize = animated.fontSize ?? clip.fontSize;
      const color = animated.color ?? clip.color;
      const lineHeight = fontSize * 1.2;

      // Font setup
      ctx.font = `${clip.fontWeight === "bold" ? "bold " : ""}${fontSize}px ${clip.fontFamily}, sans-serif`;
      ctx.fillStyle = color;

      // Use the clip's actual text alignment for multi-line text
      ctx.textAlign = clip.textAlign;
      ctx.textBaseline = "middle";

      // Wrap text into lines based on maxWidth
      const lines = this.wrapText(ctx, clip.content, clip.maxWidth ?? undefined);
      const totalHeight = lines.length * lineHeight;

      // Measure max line width for alignment and background
      let maxLineWidth = 0;
      for (const line of lines) {
        const metrics = ctx.measureText(line);
        maxLineWidth = Math.max(maxLineWidth, metrics.width);
      }

      // Calculate the horizontal offset for the anchor point based on alignment
      // The preview centers the text box at the position using transform: translate(-50%, -50%)
      // So the anchor point (0,0) corresponds to the center of the text box.

      let anchorOffsetX = 0;

      // Effective width is either the explicit maxWidth or the actual content width
      const effectiveWidth = clip.maxWidth ?? maxLineWidth;

      switch (clip.textAlign) {
        case "left":
          // Align left edge of text box to left edge of content
          // Box center is 0. Left edge is -width/2.
          anchorOffsetX = -effectiveWidth / 2;
          break;
        case "right":
          // Align right edge of text box to right edge of content
          // Box center is 0. Right edge is width/2.
          anchorOffsetX = effectiveWidth / 2;
          break;
        case "center":
        default:
          anchorOffsetX = 0;
          break;
      }

      // Background (if set)
      if (clip.backgroundColor) {
        const padding = 8;
        // Use effective width for background too
        const bgW = effectiveWidth + padding * 2;
        const bgH = totalHeight + padding;

        ctx.fillStyle = clip.backgroundColor;
        // Center the background around origin
        ctx.fillRect(-bgW / 2, -totalHeight / 2 - padding / 2, bgW, bgH);
        ctx.fillStyle = color;
      }

      // Shadow (when no background) - matches TextOverlay.tsx
      if (!clip.backgroundColor) {
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
      }

      // Draw each line, vertically centered around origin
      const startY = -totalHeight / 2 + lineHeight / 2;
      for (let i = 0; i < lines.length; i++) {
        const lineY = startY + i * lineHeight;
        ctx.fillText(lines[i], anchorOffsetX, lineY);
      }

      ctx.restore();
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private getClipsByType<T extends Clip>(type: Clip["type"]): T[] {
    return Array.from(this.clips.values()).filter((c): c is T => c.type === type);
  }

  private getActiveClips<T extends Clip>(type: Clip["type"], time: number): T[] {
    return this.getClipsByType<T>(type).filter(
      (clip) =>
        time >= clip.startTime &&
        time < clip.startTime + clip.duration &&
        this.tracks.get(clip.trackId)?.visible !== false
    );
  }

  /**
   * Get dimensions (for external use)
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.resources?.videoElements.forEach((vid) => {
      vid.src = "";
      vid.load();
    });
    this.resources = null;
  }
}
