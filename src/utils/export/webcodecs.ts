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

// ============================================================================
// Types
// ============================================================================

export interface WebCodecsExportOptions extends ExportSettings {
  duration: number;
  tracks: Map<string, Track>;
  clips: Map<string, Clip>;
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
  onProgress,
}: WebCodecsExportOptions): Promise<Blob> {
  if (!isWebCodecsSupported()) {
    throw new Error("WebCodecs not supported in this browser. Use FFmpeg export instead.");
  }

  onProgress?.(0.01);

  // 1. Initialize RenderEngine
  const renderEngine = new RenderEngine({ width, height, tracks, clips });
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
  const keyFrameInterval = fps * 2; // Keyframe every 2 seconds

  for (let frame = 0; frame < totalFrames; frame++) {
    const time = frame / fps;
    const progress = 0.1 + (frame / totalFrames) * 0.6; // 10% -> 70%
    onProgress?.(progress);

    // Render frame
    const canvas = await renderEngine.renderFrame(time);

    // Create VideoFrame from canvas
    const videoFrame = new VideoFrame(canvas, {
      timestamp: frame * (1_000_000 / fps), // microseconds
      duration: 1_000_000 / fps,
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

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  // Write video to FS
  const videoData = await fetchFile(videoBlob);
  await ffmpeg.writeFile("video.mp4", videoData);

  // Download and write audio files
  const audioInputs: { clip: VideoClip | AudioClip; filename: string }[] = [];

  for (const clip of audioClips) {
    if (tracks.get(clip.trackId)?.visible === false) continue;

    try {
      const ext = clip.type === "video" ? "mp4" : "mp3";
      const filename = `audio_${audioInputs.length}.${ext}`;
      const data = await fetchFile(clip.sourceUrl);
      await ffmpeg.writeFile(filename, data);
      audioInputs.push({ clip, filename });
    } catch (e) {
      console.error("Failed to load audio:", clip.sourceUrl, e);
    }
  }

  if (audioInputs.length === 0) {
    // No audio to mix, return original video
    return videoBlob;
  }

  onProgress?.(0.85);

  // Build FFmpeg command for audio mixing
  const ffmpegArgs: string[] = ["-i", "video.mp4"];

  for (const { filename } of audioInputs) {
    ffmpegArgs.push("-i", filename);
  }

  // Build filter complex
  let filterComplex = "";
  for (let i = 0; i < audioInputs.length; i++) {
    const { clip } = audioInputs[i];
    const inputIdx = i + 1;
    const rate = clip.type === "video" ? clip.playbackRate : 1;
    const trimStart = clip.sourceStartTime;
    const trimEnd = trimStart + clip.duration * rate;
    const delay = clip.startTime * 1000;

    let chain = `[${inputIdx}:a]`;
    chain += `atrim=start=${trimStart}:end=${trimEnd}`;
    chain += `,asetpts=PTS-STARTPTS`;

    if (Math.abs(rate - 1) > 0.01) {
      chain += `,atempo=${rate}`;
    }

    chain += `,volume=${clip.volume}`;
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

  ffmpegArgs.push(
    "-filter_complex", filterComplex,
    "-map", "0:v",
    "-map", "[aout]",
    "-c:v", "copy",       // Copy video stream (already encoded)
    "-c:a", "aac",
    "-b:a", "192k",
    "-y", "output.mp4"
  );

  onProgress?.(0.9);

  const exitCode = await ffmpeg.exec(ffmpegArgs);
  if (exitCode !== 0) {
    throw new Error("Audio mixing failed");
  }

  const data = await ffmpeg.readFile("output.mp4");
  return new Blob([data as unknown as BlobPart], { type: "video/mp4" });
}
