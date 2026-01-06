import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { Clip, Track, VideoClip, TextClip } from "@/schemas";
import type { ExportSettings, ExportQuality } from "@/components/ExportSettingsModal";

interface ExportOptions extends ExportSettings {
  duration: number;
  tracks: Map<string, Track>;
  clips: Map<string, Clip>;
  onProgress?: (progress: number) => void;
}

const cleanUp = async (ffmpeg: FFmpeg) => {
  try {
    const files = await ffmpeg.listDir(".");
    for (const f of files) {
      if (!f.isDir && (f.name.startsWith("frame") || f.name === "output.mp4")) {
        await ffmpeg.deleteFile(f.name);
      }
    }
  } catch (e) {
    // ignore cleanup errors (e.g. if FS is corrupted or empty)
  }
};

export async function exportToMp4({
  width,
  height,
  fps,
  quality,
  duration,
  tracks,
  clips,
  onProgress,
}: ExportOptions) {
  // 1. Initialize FFmpeg
  const ffmpeg = new FFmpeg();

  // Log progress
  // Log progress parsing
  // FFmpeg logs: "frame=  123 fps= 30 q=20.0 size= 1024kB time=00:00:12.34 bitrate=..."
  let parsedFrames = 0;
  ffmpeg.on("log", ({ message }) => {
    console.log("FFmpeg:", message); // Keep log enabled for debugging
    const match = message.match(/frame=\s*(\d+)/);
    if (match) {
      parsedFrames = parseInt(match[1], 10);
      // Encoding progress (0.8 to 1.0)
      const totalFrames = Math.ceil(duration * fps);
      if (totalFrames > 0) {
        const encodeProgress = parsedFrames / totalFrames;
        // Map 0-1 to 0.8-1.0 range
        const totalProgress = 0.8 + (encodeProgress * 0.2);
        onProgress?.(Math.min(0.99, totalProgress));
      }
    }
  });

  // Load ffmpeg.wasm from CDN
  // In production, these should be served locally
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  // CLEANUP BEFORE STARTING
  // This handles leftover files from previous crashed runs to avoid "FS error" (disk full)
  await cleanUp(ffmpeg);

  // 2. Prepare Resources (Canvas & Video Elements)
  // Ensure we use even dimensions for libx264
  const actualWidth = width % 2 === 0 ? width : width - 1;
  const actualHeight = height % 2 === 0 ? height : height - 1;

  const canvas = document.createElement("canvas");
  canvas.width = actualWidth;
  canvas.height = actualHeight;
  const ctx = canvas.getContext("2d")!;

  // Pre-load all video clips
  const videoClips = Array.from(clips.values()).filter(
    (c): c is VideoClip => c.type === "video"
  );

  const videoElements = new Map<string, HTMLVideoElement>();

  await Promise.all(
    videoClips.map(async (clip) => {
      const vid = document.createElement("video");
      vid.crossOrigin = "anonymous";
      vid.src = clip.sourceUrl;
      vid.muted = true;
      await new Promise((resolve, reject) => {
        vid.onloadeddata = () => resolve(true);
        vid.onerror = (e) => reject(e);
      });
      videoElements.set(clip.id, vid);
    })
  );

  // 3. Render Frames directly to FFmpeg FS
  const totalFrames = Math.ceil(duration * fps);

  // We'll batch write frames to avoid memory issues if possible, 
  // but for simple implementation we create files: frame001.png, frame002.png etc.

  for (let frame = 0; frame < totalFrames; frame++) {
    const time = frame / fps;
    const progress = (frame / totalFrames) * 0.8; // 80% rendering, 20% encoding
    onProgress?.(progress);

    // Clear Canvas
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, actualWidth, actualHeight);

    // Draw Videos
    const activeVideos = videoClips.filter(c =>
      time >= c.startTime && time < c.startTime + c.duration
    );
    const visibleVideos = activeVideos.filter(c => tracks.get(c.trackId)?.visible !== false);

    for (const clip of visibleVideos) {
      const vid = videoElements.get(clip.id);
      if (vid) {
        const seekTime = clip.sourceStartTime + (time - clip.startTime);
        await new Promise<void>((resolve, reject) => {
          const onSeeked = () => {
            vid.removeEventListener('seeked', onSeeked);
            resolve();
          };
          vid.addEventListener('seeked', onSeeked, { once: true });
          vid.currentTime = seekTime;
        });

        // Draw centered and contained
        const scale = Math.min(actualWidth / vid.videoWidth, actualHeight / vid.videoHeight);
        const w = vid.videoWidth * scale;
        const h = vid.videoHeight * scale;
        const x = (actualWidth - w) / 2;
        const y = (actualHeight - h) / 2;

        ctx.drawImage(vid, x, y, w, h);
      }
    }

    // Draw Text
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
      ctx.textBaseline = 'middle';

      if (clip.backgroundColor) {
        const metrics = ctx.measureText(clip.content);
        const bgPadding = 8;
        const bgH = clip.fontSize * 1.2;
        const bgW = metrics.width + (bgPadding * 2);

        ctx.fillStyle = clip.backgroundColor;
        let rx = x;
        if (clip.textAlign === 'center') rx = x - bgW / 2;
        if (clip.textAlign === 'right') rx = x - bgW;

        ctx.fillRect(rx, y - bgH / 2, bgW, bgH);
        ctx.fillStyle = clip.color;
      }

      if (!clip.backgroundColor) {
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;
      }

      ctx.fillText(clip.content, x, y);
      ctx.restore();
    }

    // Write frame to FFmpeg memory
    // Convert canvas to blob (JPEG is much smaller/faster for writing than PNG)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    if (blob) {
      const data = await fetchFile(blob);
      // Use padded numbering: 001, 002
      const frameName = `frame${String(frame).padStart(5, '0')}.jpg`;
      try {
        await ffmpeg.writeFile(frameName, data);
      } catch (e) {
        // If write fails (FS full), try to cleanup and throw
        console.error("Failed to write frame", frameName, e);
        await cleanUp(ffmpeg);
        throw new Error("Out of memory. Try shorter video or lower resolution.");
      }
    }
  }

  // 4. Run FFmpeg
  onProgress?.(0.9); // Encoding starts

  // -r sets input framerate
  // -i pattern used to read sequences
  // -c:v libx264 for H.264 encoding
  // -pix_fmt yuv420p required for wide compatibility
  // Determine preset/crf based on quality
  // ultrafast is recommended for browser to minimize blocking
  // CRF: 18-28 is sane range. 
  let preset = "ultrafast";
  let crf = "23"; // Medium

  if (quality === "low") {
    preset = "ultrafast";
    crf = "28";
  } else if (quality === "medium") {
    preset = "veryfast";
    crf = "23";
  } else if (quality === "high") {
    preset = "superfast"; // still want speed over compression in browser
    crf = "18";
  }

  let exitCode = 0;
  try {
    exitCode = await ffmpeg.exec([
      '-framerate', String(fps),
      '-i', 'frame%05d.jpg',
      '-c:v', 'libx264',
      '-preset', preset,
      '-crf', crf,
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      'output.mp4'
    ]);
  } catch (e) {
    console.error("FFmpeg exec error", e);
    await cleanUp(ffmpeg);
    throw new Error("Encoding failed. Try 'Draft' quality.");
  }

  if (exitCode !== 0) {
    console.error("FFmpeg exited with code", exitCode);
    await cleanUp(ffmpeg);
    throw new Error(`Encoding failed with exit code ${exitCode}. Check console for details.`);
  }

  // Read the result
  let data;
  try {
    data = await ffmpeg.readFile('output.mp4');
  } catch (e) {
    await cleanUp(ffmpeg);
    throw new Error("Failed to read output file.");
  }

  // Cleanup files to free memory for next run
  await cleanUp(ffmpeg);

  return new Blob([data as unknown as BlobPart], { type: 'video/mp4' });
}
