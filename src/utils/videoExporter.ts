import * as Mp4Muxer from "mp4-muxer";
import type { Clip, Track, VideoClip, TextClip } from "@/schemas";

interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  duration: number;
  tracks: Map<string, Track>;
  clips: Map<string, Clip>;
  onProgress?: (progress: number) => void;
}

export async function exportToMp4({
  width,
  height,
  fps,
  duration,
  tracks,
  clips,
  onProgress,
}: ExportOptions) {
  // Ensure dimensions are multiples of 2 (required by many codecs)
  const actualWidth = width % 2 === 0 ? width : width - 1;
  const actualHeight = height % 2 === 0 ? height : height - 1;

  // 1. Setup Muxer and VideoEncoder
  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: {
      codec: "avc", // H.264
      width: actualWidth,
      height: actualHeight,
    },
    fastStart: "in-memory",
  });

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error("VideoEncoder error:", e),
  });


  videoEncoder.configure({
    // avc1.64002a = High Profile (100), Level 4.2 (42)
    // Supports up to 2048x1080 @ 60fps
    codec: "avc1.64002a",
    width: actualWidth,
    height: actualHeight,
    bitrate: 6_000_000, // 6 Mbps for decent 1080p
    framerate: fps,
  });

  // 2. Prepare Resources (Canvas & Video Elements)
  const canvas = document.createElement("canvas");
  canvas.width = actualWidth;
  canvas.height = actualHeight;
  const ctx = canvas.getContext("2d")!;

  // Pre-load all video clips to HTMLVideoElements
  const videoClips = Array.from(clips.values()).filter(
    (c): c is VideoClip => c.type === "video"
  );

  const videoElements = new Map<string, HTMLVideoElement>();

  // Create video elements for each clip
  await Promise.all(
    videoClips.map(async (clip) => {
      const vid = document.createElement("video");
      vid.crossOrigin = "anonymous";
      vid.src = clip.sourceUrl;
      vid.muted = true; // Important for auto-play policies/setup
      // Wait for metadata to know duration etc usually, but we need readyState
      await new Promise((resolve, reject) => {
        vid.onloadeddata = () => resolve(true);
        vid.onerror = (e) => reject(e);
      });
      videoElements.set(clip.id, vid);
    })
  );

  // 3. Render Loop
  const totalFrames = Math.ceil(duration * fps);

  for (let frame = 0; frame < totalFrames; frame++) {
    const time = frame / fps;
    const progress = frame / totalFrames;
    onProgress?.(progress);

    // Clear Canvas
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, actualWidth, actualHeight);

    // 3a. Draw Video Layers
    // We render video layers based on their track/clip configuration.

    // We typically render from bottom track to top track (or specifically how visual layering works)
    // Standard NLE: Higher track number usually overlays lower? Or Track 0 is top?
    // In CSS "z-index", usually last element in DOM is on top.
    // In our Timeline component, tracks are rendered in order.
    // BUT video/text composition usually implies higher order = on top OR Track 0 is top.
    // Let's assume Track 0 is visually on top for specific UI, but for rendering layers:
    // If Track 0 is "Video 1" and Track 1 is "Text", Text usually overlays Video.
    // Let's iterate tracks in order (0 to N) but often the convention is Track 0 is top.
    // However, painter's algorithm: draw bottom-most layer first.
    // Let's assume Track N (bottom of list) is "background" and Track 0 is "foreground"?
    // Actually, in `VideoPreview.tsx`, `activeVideoClip` is just *one* clip found.
    // Wait, the current `VideoPreview` only supports ONE active video track at a time properly?
    // It maps `videoClips`, and renders them. `VideoLayer` uses `z-index` based on `isActive`.
    // It seems `VideoPreview` doesn't strictly layer tracks yet, it just shows whatever is active.
    // If multiple videos are active, they stack by DOM order (clip ID order).
    // Let's try to follow: render all active video clips.

    // Find active video clips at this time
    const activeVideos = videoClips.filter(c =>
      time >= c.startTime && time < c.startTime + c.duration
    );

    // Filter by track visibility
    const visibleVideos = activeVideos.filter(c => tracks.get(c.trackId)?.visible !== false);

    for (const clip of visibleVideos) {
      const vid = videoElements.get(clip.id);
      if (vid) {
        // Calculate seek time provided playbackRate=1
        const seekTime = clip.sourceStartTime + (time - clip.startTime);

        // Seek relative to frame
        // Wait for seek (crucial for frame accuracy)
        await new Promise<void>((resolve, reject) => {
          const onSeeked = () => {
            vid.removeEventListener('seeked', onSeeked);
            resolve();
          };
          vid.addEventListener('seeked', onSeeked, { once: true });
          vid.currentTime = seekTime;
        });

        // Draw
        // Maintain Aspect Ratio (contain)
        const scale = Math.min(actualWidth / vid.videoWidth, actualHeight / vid.videoHeight);
        const w = vid.videoWidth * scale;
        const h = vid.videoHeight * scale;
        const x = (actualWidth - w) / 2;
        const y = (actualHeight - h) / 2;

        ctx.drawImage(vid, x, y, w, h);
      }
    }

    // 3b. Draw Text Layers
    const textClips = Array.from(clips.values()).filter((c): c is TextClip => c.type === "text");
    const activeTexts = textClips.filter(c =>
      time >= c.startTime && time < c.startTime + c.duration && tracks.get(c.trackId)?.visible !== false
    );

    for (const clip of activeTexts) {
      const x = (clip.position.x / 100) * actualWidth;
      const y = (clip.position.y / 100) * actualHeight;

      ctx.save();
      ctx.font = `${clip.fontWeight === 'bold' ? 'bold ' : ''}${clip.fontSize}px ${clip.fontFamily}, sans-serif`;
      ctx.fillStyle = clip.color;
      ctx.textAlign = clip.textAlign;
      ctx.textBaseline = 'middle'; // visually easier to center

      // Handle Background
      if (clip.backgroundColor) {
        const metrics = ctx.measureText(clip.content);
        const bgPadding = 8;
        const bgH = clip.fontSize * 1.2; // approx
        const bgW = metrics.width + (bgPadding * 2);

        ctx.fillStyle = clip.backgroundColor;
        // approximate RECT based on align
        let rx = x;
        if (clip.textAlign === 'center') rx = x - bgW / 2;
        if (clip.textAlign === 'right') rx = x - bgW;

        ctx.fillRect(rx, y - bgH / 2, bgW, bgH);
        ctx.fillStyle = clip.color;
      }

      // Shadow
      if (!clip.backgroundColor) {
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
      }

      ctx.fillText(clip.content, x, y);
      ctx.restore();
    }

    // 4. Encode Frame
    const videoFrame = new VideoFrame(canvas, {
      timestamp: frame * (1000000 / fps), // microseconds
      duration: 1000000 / fps
    });

    videoEncoder.encode(videoFrame, { keyFrame: frame % (fps * 2) === 0 });
    videoFrame.close();
  }

  // 5. Finish
  await videoEncoder.flush();
  muxer.finalize();

  const { buffer } = muxer.target;
  return new Blob([buffer], { type: "video/mp4" });
}
