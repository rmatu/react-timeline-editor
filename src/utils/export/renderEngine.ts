/**
 * Unified Render Engine for Video Export
 *
 * Mirrors VideoPreview.tsx rendering logic to ensure WYSIWYG export.
 * Renders all layers (video, text, stickers) to canvas for frame-accurate export.
 * Supports keyframe animations via the same interpolation logic as preview.
 */

import type { Clip, Track, VideoClip, TextClip, StickerClip } from "@/schemas";
import { getAnimatedPropertiesAtTime } from "@/utils/keyframes";

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

    // Load sticker images
    const stickerClips = this.getClipsByType<StickerClip>("sticker");
    await Promise.all(
      stickerClips.map(async (clip) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = clip.assetUrl;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Failed to load sticker: ${clip.assetUrl}`));
        });
        stickerImages.set(clip.id, img);
      })
    );

    this.resources = { videoElements, stickerImages };
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

      // Draw video maintaining aspect ratio (contain mode)
      const scale = Math.min(this.width / vid.videoWidth, this.height / vid.videoHeight);
      const w = vid.videoWidth * scale;
      const h = vid.videoHeight * scale;
      const x = (this.width - w) / 2;
      const y = (this.height - h) / 2;

      // Apply keyframe animations (opacity, scale, rotation)
      this.ctx.save();
      this.ctx.globalAlpha = animated.opacity;

      // Apply scale and rotation transforms around center
      const centerX = x + w / 2;
      const centerY = y + h / 2;
      this.ctx.translate(centerX, centerY);
      this.ctx.scale(animated.scale, animated.scale);
      this.ctx.rotate((animated.rotation * Math.PI) / 180);
      this.ctx.translate(-centerX, -centerY);

      this.ctx.drawImage(vid, x, y, w, h);
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

    for (const clip of stickerClips) {
      const img = this.resources!.stickerImages.get(clip.id);
      if (!img) continue;

      // Get animated properties for keyframe animations
      const animated = getAnimatedPropertiesAtTime(clip, time);

      const ctx = this.ctx;
      ctx.save();

      // Position (use animated position, percentage to pixels, centered)
      const x = (animated.position.x / 100) * this.width;
      const y = (animated.position.y / 100) * this.height;

      ctx.translate(x, y);
      ctx.rotate((animated.rotation * Math.PI) / 180);
      ctx.scale(animated.scale, animated.scale);
      ctx.globalAlpha = animated.opacity;

      // Draw centered
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      ctx.restore();
    }
  }

  private renderTextLayer(time: number): void {
    const textClips = this.getActiveClips<TextClip>("text", time);

    for (const clip of textClips) {
      // Get animated properties for keyframe animations
      const animated = getAnimatedPropertiesAtTime(clip, time);

      const ctx = this.ctx;

      // Position (use animated position, percentage to pixels)
      // The preview uses transform: translate(-50%, -50%) to center text at position
      // So we must use textAlign: center and textBaseline: middle to match
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

      // Font setup
      ctx.font = `${clip.fontWeight === "bold" ? "bold " : ""}${fontSize}px ${clip.fontFamily}, sans-serif`;
      ctx.fillStyle = color;
      // Always center-align for positioning (matches preview's translate(-50%, -50%))
      // The clip.textAlign only affects word-wrapping within the text box in preview
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Background (if set)
      if (clip.backgroundColor) {
        const metrics = ctx.measureText(clip.content);
        const padding = 8;
        const bgH = fontSize * 1.2;
        const bgW = metrics.width + padding * 2;

        ctx.fillStyle = clip.backgroundColor;
        // Center the background around origin
        const rx = -bgW / 2;

        ctx.fillRect(rx, -bgH / 2, bgW, bgH);
        ctx.fillStyle = color;
      }

      // Shadow (when no background) - matches TextOverlay.tsx
      if (!clip.backgroundColor) {
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
      }

      ctx.fillText(clip.content, 0, 0); // Draw at origin (already translated)
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
