/**
 * WebCodecs-based Video Exporter with Hardware Acceleration
 *
 * Uses GPU-accelerated VideoEncoder for significantly faster encoding.
 * Falls back to FFmpeg for audio mixing (WebCodecs doesn't handle audio muxing).
 */

import * as Mp4Muxer from "mp4-muxer";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { Clip, Track, VideoClip, AudioClip } from "@/schemas";
import type { ExportSettings } from "@/components/ExportSettingsModal";
import { RenderEngine } from "./renderEngine";
import { CanvasBackground } from "@/stores/timelineStore";

// ============================================================================
// Types
// ============================================================================

export interface WebCodecsExportOptions extends ExportSettings {
  duration: number;
  tracks: Map<string, Track>;
  clips: Map<string, Clip>;
  canvasBackground: CanvasBackground;
  onProgress?: (progress: number) => void;
}

// ============================================================================
// Feature Detection
// ============================================================================

export function isWebCodecsSupported(): boolean {
  return (
    typeof VideoEncoder !== "undefined" &&
    typeof VideoFrame !== "undefined" &&
    typeof EncodedVideoChunk !== "undefined"
  );
}

// ============================================================================
// WebCodecs Exporter
// ============================================================================

export async function exportWithWebCodecs({
  width,
  height,
  fps,
  quality,
  duration,
  tracks,
  clips,
  canvasBackground,
  onProgress,
}: WebCodecsExportOptions): Promise<Blob> {
  if (!isWebCodecsSupported()) {
    throw new Error("WebCodecs not supported in this browser. Use FFmpeg export instead.");
  }

  onProgress?.(0.01);

  // 1. Initialize RenderEngine
  const renderEngine = new RenderEngine({ width, height, tracks, clips, canvasBackground });
  const { width: actualWidth, height: actualHeight } = renderEngine.getDimensions();

  await renderEngine.loadResources();
  onProgress?.(0.05);

  // 2. Check if we have audio clips
  const audioClips = Array.from(clips.values()).filter(
    (c): c is VideoClip | AudioClip =>
      (c.type === "video" || c.type === "audio") &&
      !c.muted &&
      !tracks.get(c.trackId)?.muted
  );
  const hasAudio = audioClips.length > 0;

  // 3. Setup Mp4Muxer for video-only encoding (audio added later via FFmpeg)
  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: {
      codec: "avc",
      width: actualWidth,
      height: actualHeight,
    },
    // Normalize timestamps to enforce constant frame rate (CFR)
    // Prevents variable frame rate output which causes playback stuttering
    firstTimestampBehavior: "offset",
    fastStart: "in-memory",
  });

  // 4. Configure VideoEncoder with Hardware Acceleration
  const bitrates: Record<string, number> = {
    high: 8_000_000,    // 8 Mbps
    medium: 5_000_000,  // 5 Mbps
    low: 2_500_000,     // 2.5 Mbps
  };

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error("VideoEncoder error:", e),
  });

  await videoEncoder.configure({
    codec: "avc1.64002a", // H.264 High Profile, Level 4.2
    width: actualWidth,
    height: actualHeight,
    bitrate: bitrates[quality] || bitrates.medium,
    framerate: fps,
    hardwareAcceleration: "prefer-hardware", // ⚡ GPU acceleration
  });

  onProgress?.(0.08);

  // 5. Render and encode frames
  const totalFrames = Math.ceil(duration * fps);
  // Keyframe every 1 second (not 2) for smoother playback and seeking at high frame rates
  const keyFrameInterval = Math.round(fps);

  for (let frame = 0; frame < totalFrames; frame++) {
    const time = frame / fps;
    const progress = 0.1 + (frame / totalFrames) * 0.6; // 10% -> 70%
    onProgress?.(progress);

    // Render frame
    const canvas = await renderEngine.renderFrame(time);

    // Create VideoFrame from canvas
    // Use integer math to avoid floating-point precision issues at high frame rates
    // e.g., 60fps: 1_000_000/60 = 16666.666... causes cumulative drift
    const videoFrame = new VideoFrame(canvas, {
      timestamp: Math.round((frame * 1_000_000) / fps), // microseconds, integer precision
      duration: Math.round(1_000_000 / fps),
    });

    // Encode (keyframe every N frames)
    videoEncoder.encode(videoFrame, {
      keyFrame: frame % keyFrameInterval === 0,
    });

    videoFrame.close();
  }

  // 6. Flush encoder
  await videoEncoder.flush();
  muxer.finalize();
  renderEngine.dispose();

  onProgress?.(0.75);

  // 7. Get video-only blob
  const videoBlob = new Blob([muxer.target.buffer], { type: "video/mp4" });

  // 8. If no audio, return video-only
  if (!hasAudio) {
    onProgress?.(1);
    return videoBlob;
  }

  // 9. Mix audio using FFmpeg (WebCodecs doesn't support audio muxing)
  onProgress?.(0.8);
  const finalBlob = await mixAudioWithFFmpeg(videoBlob, audioClips, tracks, onProgress);

  onProgress?.(1);
  return finalBlob;
}

// ============================================================================
// Audio Mixing with FFmpeg
// ============================================================================

async function mixAudioWithFFmpeg(
  videoBlob: Blob,
  audioClips: (VideoClip | AudioClip)[],
  tracks: Map<string, Track>,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const ffmpeg = new FFmpeg();
  
  // Collect FFmpeg logs for debugging
  const logs: string[] = [];
  ffmpeg.on("log", ({ message }) => {
    logs.push(message);
    console.log("[FFmpeg]", message);
  });

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  // Write video to FS
  const videoData = await fetchFile(videoBlob);
  await ffmpeg.writeFile("video.mp4", videoData);

  // Download and write audio files, then probe which ones actually have audio streams
  const audioInputs: { clip: VideoClip | AudioClip; filename: string; hasAudio: boolean }[] = [];

  for (const clip of audioClips) {
    if (tracks.get(clip.trackId)?.visible === false) continue;

    try {
      // Detect extension from URL or default based on type
      let ext = "mp4";
      const urlLower = clip.sourceUrl.toLowerCase();
      if (urlLower.includes(".mp3") || clip.type === "audio") {
        ext = "mp3";
      } else if (urlLower.includes(".wav")) {
        ext = "wav";
      } else if (urlLower.includes(".m4a")) {
        ext = "m4a";
      } else if (urlLower.includes(".ogg")) {
        ext = "ogg";
      }
      
      const filename = `audio_${audioInputs.length}.${ext}`;
      const data = await fetchFile(clip.sourceUrl);
      await ffmpeg.writeFile(filename, data);
      audioInputs.push({ clip, filename, hasAudio: true }); // Will verify below
    } catch (e) {
      console.error("Failed to load audio:", clip.sourceUrl, e);
    }
  }

  if (audioInputs.length === 0) {
    // No audio to mix, return original video
    return videoBlob;
  }

  // Probe each file to check if it has an audio stream
  // Video files may not have audio tracks
  const validAudioInputs: { clip: VideoClip | AudioClip; filename: string }[] = [];
  
  for (const input of audioInputs) {
    // Use -map 0:a to explicitly require an audio stream - this will fail if no audio exists
    const probeResult = await ffmpeg.exec([
      "-i", input.filename,
      "-map", "0:a",        // Explicitly select audio stream (fails if none)
      "-t", "0.001",        // Only process 1ms
      "-f", "null",
      "-y",
      "/dev/null"
    ]);
    
    if (probeResult === 0) {
      // File has audio
      validAudioInputs.push({ clip: input.clip, filename: input.filename });
      console.log(`[FFmpeg] ${input.filename} has audio stream`);
    } else {
      console.log(`[FFmpeg] Skipping ${input.filename} - no audio stream found`);
    }
  }

  if (validAudioInputs.length === 0) {
    // No valid audio to mix, return original video
    console.log("[FFmpeg] No audio streams found in any clips, returning video-only");
    return videoBlob;
  }

  onProgress?.(0.85);

  // Build FFmpeg command for audio mixing
  const ffmpegArgs: string[] = ["-i", "video.mp4"];

  for (const { filename } of validAudioInputs) {
    ffmpegArgs.push("-i", filename);
  }

  // Build filter complex (using validAudioInputs now)
  const filterParts: string[] = [];
  for (let i = 0; i < validAudioInputs.length; i++) {
    const { clip } = validAudioInputs[i];
    const inputIdx = i + 1;
    const rate = clip.type === "video" ? (clip.playbackRate || 1) : 1;
    const trimStart = clip.sourceStartTime || 0;
    const trimEnd = trimStart + clip.duration * rate;
    const delay = Math.round((clip.startTime || 0) * 1000); // milliseconds, integer

    // Build the filter chain for this audio input
    let chain = `[${inputIdx}:a]`;
    chain += `atrim=start=${trimStart.toFixed(3)}:end=${trimEnd.toFixed(3)}`;
    chain += `,asetpts=PTS-STARTPTS`;

    if (Math.abs(rate - 1) > 0.01) {
      // atempo only accepts values between 0.5 and 2.0
      // For values outside that range, chain multiple atempo filters
      const clampedRate = Math.max(0.5, Math.min(2.0, rate));
      chain += `,atempo=${clampedRate.toFixed(3)}`;
    }

    const volume = typeof clip.volume === "number" ? clip.volume : 1;
    chain += `,volume=${volume.toFixed(3)}`;
    
    if (delay > 0) {
      chain += `,adelay=${delay}|${delay}`;
    }
    chain += `[a${i}]`;

    filterParts.push(chain);
  }

  let filterComplex = filterParts.join(";");

  if (validAudioInputs.length > 1) {
    filterComplex += ";";
    validAudioInputs.forEach((_, i) => (filterComplex += `[a${i}]`));
    filterComplex += `amix=inputs=${validAudioInputs.length}:duration=longest:normalize=0[aout]`;
  } else {
    filterComplex += ";[a0]anull[aout]";
  }

  console.log("[FFmpeg] Filter complex:", filterComplex);

  ffmpegArgs.push(
    "-filter_complex", filterComplex,
    "-map", "0:v",
    "-map", "[aout]",
    "-c:v", "copy",       // Copy video stream (already encoded)
    "-c:a", "aac",
    "-b:a", "192k",
    "-y", "output.mp4"
  );

  console.log("[FFmpeg] Command:", ffmpegArgs.join(" "));

  onProgress?.(0.9);

  const exitCode = await ffmpeg.exec(ffmpegArgs);
  if (exitCode !== 0) {
    const lastLogs = logs.slice(-20).join("\n");
    console.error("[FFmpeg] Failed with exit code:", exitCode);
    console.error("[FFmpeg] Last logs:\n", lastLogs);
    throw new Error(`Audio mixing failed (exit code ${exitCode}). Check console for FFmpeg logs.`);
  }

  const data = await ffmpeg.readFile("output.mp4");
  return new Blob([data as unknown as BlobPart], { type: "video/mp4" });
}
