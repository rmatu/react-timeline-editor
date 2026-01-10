/**
 * Unified Video Exporter using FFmpeg WASM
 *
 * Uses RenderEngine for frame-accurate rendering of all layers,
 * with proper CFR enforcement for smooth playback.
 */

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { Clip, Track, VideoClip, AudioClip } from "@/schemas";
import type { ExportSettings } from "@/components/ExportSettingsModal";
import { RenderEngine } from "./renderEngine";
import { CanvasBackground } from "@/stores/timelineStore";

// ============================================================================
// Types
// ============================================================================

export interface ExportOptions extends ExportSettings {
  duration: number;
  tracks: Map<string, Track>;
  clips: Map<string, Clip>;
  canvasBackground: CanvasBackground;
  onProgress?: (progress: number) => void;
}

interface AudioInputInfo {
  clip: VideoClip | AudioClip;
  filename: string;
}

// ============================================================================
// Helpers
// ============================================================================

const cleanUp = async (ffmpeg: FFmpeg) => {
  try {
    const files = await ffmpeg.listDir(".");
    for (const f of files) {
      if (
        !f.isDir &&
        (f.name.startsWith("frame") || f.name.startsWith("input_") || f.name === "output.mp4")
      ) {
        await ffmpeg.deleteFile(f.name);
      }
    }
  } catch {
    // Ignore cleanup errors
  }
};

/**
 * Check if a media URL has audio tracks
 */
const hasAudioTrack = async (url: string, type: "video" | "audio"): Promise<boolean> => {
  // Audio files always have audio
  if (type === "audio") return true;

  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";

    const cleanup = () => {
      video.src = "";
      video.load();
    };

    video.onloadedmetadata = () => {
      // Try audioTracks API first (Safari)
      const audioTracks = (video as unknown as { audioTracks?: { length: number } }).audioTracks;
      if (audioTracks !== undefined) {
        resolve(audioTracks.length > 0);
      } else {
        // Assume video has audio (most common case)
        resolve(true);
      }
      cleanup();
    };

    video.onerror = () => {
      cleanup();
      resolve(false);
    };

    setTimeout(() => {
      cleanup();
      resolve(false);
    }, 5000);

    video.src = url;
  });
};

// ============================================================================
// Export Function
// ============================================================================

export async function exportToMp4({
  width,
  height,
  fps,
  quality,
  duration,
  tracks,
  clips,
  canvasBackground,
  onProgress,
}: ExportOptions): Promise<Blob> {
  onProgress?.(0.01);

  // 1. Initialize RenderEngine
  const renderEngine = new RenderEngine({ width, height, tracks, clips, canvasBackground });
  const { width: actualWidth, height: actualHeight } = renderEngine.getDimensions();

  onProgress?.(0.02);

  // 2. Load all media resources
  await renderEngine.loadResources();
  onProgress?.(0.05);

  // 3. Initialize FFmpeg
  const ffmpeg = new FFmpeg();

  // Parse FFmpeg log for progress during encoding
  ffmpeg.on("log", ({ message }) => {
    console.log("FFmpeg:", message);
    const match = message.match(/frame=\s*(\d+)/);
    if (match) {
      const parsedFrames = parseInt(match[1], 10);
      const totalFrames = Math.ceil(duration * fps);
      if (totalFrames > 0) {
        // Encoding is 80% -> 100%
        const encodeProgress = parsedFrames / totalFrames;
        onProgress?.(0.8 + encodeProgress * 0.19);
      }
    }
  });

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  await cleanUp(ffmpeg);
  onProgress?.(0.08);

  // 4. Prepare audio inputs
  const audioClips = Array.from(clips.values()).filter(
    (c): c is VideoClip | AudioClip =>
      (c.type === "video" || c.type === "audio") &&
      !c.muted &&
      !tracks.get(c.trackId)?.muted &&
      tracks.get(c.trackId)?.visible !== false
  );

  const audioInputs: AudioInputInfo[] = [];
  for (const clip of audioClips) {
    try {
      const hasAudio = await hasAudioTrack(clip.sourceUrl, clip.type);
      if (!hasAudio) continue;

      const ext = clip.type === "video" ? "mp4" : "mp3";
      const filename = `input_${audioInputs.length}.${ext}`;

      const data = await fetchFile(clip.sourceUrl);
      await ffmpeg.writeFile(filename, data);
      audioInputs.push({ clip, filename });
    } catch (e) {
      console.error("Failed to load audio:", clip.sourceUrl, e);
    }
  }

  onProgress?.(0.1);

  // 5. Render frames using RenderEngine
  const totalFrames = Math.ceil(duration * fps);

  for (let frame = 0; frame < totalFrames; frame++) {
    const time = frame / fps;
    const progress = 0.1 + (frame / totalFrames) * 0.7; // 10% -> 80%
    onProgress?.(progress);

    // Render frame using unified engine
    await renderEngine.renderFrame(time);

    // Get frame as JPEG and write to FFmpeg FS
    const blob = await renderEngine.getFrameBlob(0.8);
    if (blob) {
      const data = await fetchFile(blob);
      const frameName = `frame${String(frame).padStart(5, "0")}.jpg`;
      try {
        await ffmpeg.writeFile(frameName, data);
      } catch (e) {
        console.error("Failed to write frame:", frameName, e);
        renderEngine.dispose();
        await cleanUp(ffmpeg);
        throw new Error("Out of memory. Try shorter video or lower resolution.");
      }
    }
  }

  renderEngine.dispose();
  onProgress?.(0.8);

  // 6. Build FFmpeg command
  const ffmpegArgs: string[] = [
    "-framerate", String(fps),
    "-i", "frame%05d.jpg",
  ];

  // Add audio inputs
  for (const { filename } of audioInputs) {
    ffmpegArgs.push("-i", filename);
  }

  // Build audio filter complex
  let filterComplex = "";
  if (audioInputs.length > 0) {
    for (let i = 0; i < audioInputs.length; i++) {
      const { clip } = audioInputs[i];
      const inputIdx = i + 1;
      const rate = clip.type === "video" ? clip.playbackRate : 1;
      const trimStart = clip.sourceStartTime;
      const trimEnd = trimStart + clip.duration * rate;
      const delay = clip.startTime * 1000; // ms

      let chain = `[${inputIdx}:a]`;
      chain += `atrim=start=${trimStart}:end=${trimEnd}`;
      chain += `,asetpts=PTS-STARTPTS`;

      if (Math.abs(rate - 1) > 0.01) {
        chain += `,atempo=${rate}`;
      }

      chain += `,volume=${clip.volume}`;

      // Audio-specific fade
      if (clip.type === "audio") {
        if (clip.fadeIn > 0) {
          chain += `,afade=t=in:ss=0:d=${clip.fadeIn}`;
        }
        if (clip.fadeOut > 0) {
          const fadeOutStart = clip.duration - clip.fadeOut;
          if (fadeOutStart > 0) {
            chain += `,afade=t=out:st=${fadeOutStart}:d=${clip.fadeOut}`;
          }
        }
      }

      chain += `,adelay=${delay}|${delay}`;
      chain += `[a${i}]`;

      if (i > 0) filterComplex += ";";
      filterComplex += chain;
    }

    if (audioInputs.length > 1) {
      filterComplex += ";";
      audioInputs.forEach((_, i) => (filterComplex += `[a${i}]`));
      filterComplex += `amix=inputs=${audioInputs.length}:duration=longest:normalize=0[aout]`;
    } else {
      filterComplex += ";[a0]anull[aout]";
    }
  }

  // Quality presets
  let preset = "ultrafast";
  let crf = "23";
  if (quality === "low") { preset = "ultrafast"; crf = "28"; }
  else if (quality === "medium") { preset = "veryfast"; crf = "23"; }
  else if (quality === "high") { preset = "superfast"; crf = "18"; }

  // Output encoding args with CFR enforcement
  const outputArgs = [
    "-r", String(fps),       // Output framerate
    "-vsync", "cfr",         // Constant frame rate
    "-c:v", "libx264",
    "-preset", preset,
    "-crf", crf,
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-s", `${actualWidth}x${actualHeight}`,
    "-y",
  ];

  // Map video
  outputArgs.push("-map", "0:v");

  // Map audio
  if (audioInputs.length > 0) {
    outputArgs.push("-filter_complex", filterComplex);
    outputArgs.push("-map", "[aout]");
    outputArgs.push("-c:a", "aac");
    outputArgs.push("-b:a", "192k");
  }

  outputArgs.push("output.mp4");

  const execArgs = [...ffmpegArgs, ...outputArgs];
  console.log("FFmpeg Command:", execArgs.join(" "));

  // 7. Execute FFmpeg
  let exitCode = 0;
  try {
    exitCode = await ffmpeg.exec(execArgs);
  } catch (e) {
    console.error("FFmpeg exec error:", e);
    await cleanUp(ffmpeg);
    throw new Error("Encoding failed. Try 'Draft' quality.");
  }

  if (exitCode !== 0) {
    await cleanUp(ffmpeg);
    throw new Error(`Encoding failed with exit code ${exitCode}.`);
  }

  // 8. Read output
  let data;
  try {
    data = await ffmpeg.readFile("output.mp4");
  } catch {
    await cleanUp(ffmpeg);
    throw new Error("Failed to read output file.");
  }

  await cleanUp(ffmpeg);
  onProgress?.(1);

  return new Blob([data as unknown as BlobPart], { type: "video/mp4" });
}
