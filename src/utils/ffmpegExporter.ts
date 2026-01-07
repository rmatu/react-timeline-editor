import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { Clip, Track, VideoClip, TextClip, AudioClip } from "@/schemas";
import type { ExportSettings } from "@/components/ExportSettingsModal";

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
      if (!f.isDir && (f.name.startsWith("frame") || f.name.startsWith("input_") || f.name === "output.mp4")) {
        await ffmpeg.deleteFile(f.name);
      }
    }
  } catch (e) {
    // ignore cleanup errors (e.g. if FS is corrupted or empty)
  }
};

// Helper to check if a media URL has audio tracks using HTMLMediaElement
const hasAudioTrack = async (url: string, type: 'video' | 'audio'): Promise<boolean> => {
  return new Promise((resolve) => {
    // Audio files always have audio
    if (type === 'audio') {
      resolve(true);
      return;
    }

    // For video, check using HTMLVideoElement
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';

    const cleanup = () => {
      video.src = '';
      video.load();
    };

    video.onloadedmetadata = () => {
      // Check if video has audio tracks
      // Note: audioTracks is not universally supported, fallback to true
      const audioTracks = (video as unknown as { audioTracks?: { length: number } }).audioTracks;
      if (audioTracks !== undefined) {
        resolve(audioTracks.length > 0);
      } else {
        // For browsers that don't support audioTracks, use Web Audio API probe
        probeAudioWithWebAudio(url).then(resolve).catch(() => resolve(false));
      }
      cleanup();
    };

    video.onerror = () => {
      cleanup();
      resolve(false);
    };

    // Timeout fallback
    setTimeout(() => {
      cleanup();
      resolve(false);
    }, 5000);

    video.src = url;
  });
};

// Fallback: Use Web Audio API to probe for audio
const probeAudioWithWebAudio = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new AudioContext();

    try {
      await audioContext.decodeAudioData(arrayBuffer.slice(0, Math.min(arrayBuffer.byteLength, 1024 * 1024))); // Only decode first 1MB
      audioContext.close();
      return true;
    } catch {
      audioContext.close();
      return false;
    }
  } catch {
    return false;
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

  // Collect relevant clips (Video and Audio)
  // Sort by startTime to effectively manage inputs, though basic listing is fine
  const audioCapableClips = Array.from(clips.values()).filter((c): c is VideoClip | AudioClip => {
    // Must be audio or video
    if (c.type !== "video" && c.type !== "audio") return false;
    // Must only be visible and audible (track settings)
    const track = tracks.get(c.trackId);
    if (track?.visible === false) return false; // Although hidden tracks might still play audio in some editors, usually "mute" is separate. 
    // But standard timeline logic: if track is hidden, usually visuals are hidden. Mute handles audio.
    // Let's stick to: check track.muted and clip.muted
    if (track?.muted || c.muted) return false;
    return true;
  });

  const videoClips = Array.from(clips.values()).filter(
    (c): c is VideoClip => c.type === "video" && tracks.get(c.trackId)?.visible !== false
  );

  // Load video elements for CANVAS DRAWING (Visuals)
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

  // Download Audio Files for FFmpeg (Audio Mixing)
  // We need to write these files to the FS to use them as inputs
  // First, probe each clip to see if it actually has audio
  const audioInputMap = new Map<string, string>(); // clipId -> fsFilename
  const clipsWithAudio: (VideoClip | AudioClip)[] = [];

  onProgress?.(0.05); // Started probing and downloading

  // Probe and download audio files
  for (let index = 0; index < audioCapableClips.length; index++) {
    const clip = audioCapableClips[index];
    try {
      // Check if this file actually has audio
      const hasAudio = await hasAudioTrack(clip.sourceUrl, clip.type);
      if (!hasAudio) {
        console.log(`Skipping clip ${clip.id} - no audio track detected`);
        continue;
      }

      const ext = clip.type === 'video' ? 'mp4' : 'mp3';
      const filename = `input_${clipsWithAudio.length}.${ext}`;

      const data = await fetchFile(clip.sourceUrl);
      await ffmpeg.writeFile(filename, data);
      audioInputMap.set(clip.id, filename);
      clipsWithAudio.push(clip);
    } catch (e) {
      console.error("Failed to download/probe audio asset", clip, e);
    }
  }

  // 3. Render Frames directly to FFmpeg FS
  const totalFrames = Math.ceil(duration * fps);

  for (let frame = 0; frame < totalFrames; frame++) {
    const time = frame / fps;
    const progress = 0.1 + (frame / totalFrames) * 0.7; // 10% -> 80%
    onProgress?.(progress);

    // Clear Canvas
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, actualWidth, actualHeight);

    // Draw Videos
    const activeVideos = videoClips.filter(c =>
      time >= c.startTime && time < c.startTime + c.duration
    );

    // Check global track visibility for rendering
    const visibleVideos = activeVideos.filter(c => tracks.get(c.trackId)?.visible !== false);

    for (const clip of visibleVideos) {
      const vid = videoElements.get(clip.id);
      if (vid) {
        const seekTime = clip.sourceStartTime + (time - clip.startTime) * clip.playbackRate;
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            vid.removeEventListener('seeked', onSeeked);
            resolve();
          };
          // If strictly ensuring frames:
          if (Math.abs(vid.currentTime - seekTime) > 0.05) {
            vid.addEventListener('seeked', onSeeked, { once: true });
            vid.currentTime = seekTime;
          } else {
            resolve();
          }
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

    // Write frame
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    if (blob) {
      const data = await fetchFile(blob);
      const frameName = `frame${String(frame).padStart(5, '0')}.jpg`;
      try {
        await ffmpeg.writeFile(frameName, data);
      } catch (e) {
        console.error("Failed to write frame", frameName, e);
        await cleanUp(ffmpeg);
        throw new Error("Out of memory. Try shorter video or lower resolution.");
      }
    }
  }

  // 4. Run FFmpeg
  onProgress?.(0.85); // Encoding starts

  // Construct FFmpeg command
  const ffmpegArgs: string[] = [
    '-framerate', String(fps),
    '-i', 'frame%05d.jpg', // Input 0: Video Sequence
  ];

  // Use clipsWithAudio which contains only clips with verified audio streams
  // Add audio inputs
  // Map index in clipsWithAudio to FFmpeg input index (0 is video, so 1+index)
  clipsWithAudio.forEach((clip) => {
    const filename = audioInputMap.get(clip.id);
    if (filename) {
      ffmpegArgs.push('-i', filename);
    }
  });

  // Build complex filter for mixing
  let filterComplex = "";

  if (clipsWithAudio.length > 0) {
    // Process each clip
    clipsWithAudio.forEach((clip, index) => {
      const inputIdx = index + 1; // 0 is frames
      // Params
      const trimStart = clip.sourceStartTime;
      // Calculate source duration based on playback rate check if needed?
      // For audio, changing speed usually requires 'atempo' filter.
      // VideoClip has playbackRate. AudioClip does not (in schema yet? let's check).
      // Checking schema:
      // VideoClipSchema: playbackRate: z.number().positive().default(1)
      // AudioClipSchema: fadeIn, fadeOut. NO playbackRate.

      // So only apply atempo if it's a VideoClip and rate != 1
      const rate = clip.type === 'video' ? clip.playbackRate : 1;
      const duration = clip.duration; // Timeline duration

      // Source duration needed = duration * rate. 
      // e.g. 5s on timeline at 2x speed needs 10s of source audio.
      // atrim end = start + (duration * rate)

      const sourceDuration = duration * rate;
      const trimEnd = trimStart + sourceDuration;

      const delay = clip.startTime * 1000; // ms

      // Build filter chain for this input
      // [1:a] atrim=start=...:end=..., asetpts=PTS-STARTPTS, volume=..., adelay=...|... [a1]

      let chain = `[${inputIdx}:a]`;

      // 1. Trim source
      chain += `atrim=start=${trimStart}:end=${trimEnd}`;
      chain += `,asetpts=PTS-STARTPTS`;

      // 2. Playback Rate (atempo)
      // atempo supports 0.5 to 2.0. If outside, need chaining.
      // simple implementation for 0.5-2.0
      if (Math.abs(rate - 1) > 0.01) {
        chain += `,atempo=${rate}`;
      }

      // 3. Volume
      chain += `,volume=${clip.volume}`;

      // 4. Muted is handled by filtering out list earlier? Yes.

      // 5. Fade In/Out (AudioClip only in schema?)
      if (clip.type === 'audio') {
        // afade=t=in:ss=0:d=...
        if (clip.fadeIn > 0) {
          chain += `,afade=t=in:ss=0:d=${clip.fadeIn}`;
        }
        if (clip.fadeOut > 0) {
          // We need to know the total duration of the clip audio stream to set start time for fade out?
          // or use st=... relative to start
          // afade=t=out:st=...:d=...
          // st is start time in seconds relative to stream start.
          // stream is 'duration' seconds long (timeline time).
          const fadeOutStart = duration - clip.fadeOut;
          if (fadeOutStart > 0) {
            chain += `,afade=t=out:st=${fadeOutStart}:d=${clip.fadeOut}`;
          }
        }
      }

      // 6. Delay (position on timeline)
      // adelay adds silence. It needs delay for each channel. Assuming stereo (delay|delay).
      // Note: adelay preserves the original stream but prepends silence.
      chain += `,adelay=${delay}|${delay}`;

      chain += `[a${index}]`;

      if (index > 0) filterComplex += ";";
      filterComplex += chain;
    });

    // Mix all [a0] [a1] ...
    if (clipsWithAudio.length > 1) {
      filterComplex += ";";
      clipsWithAudio.forEach((_, i) => filterComplex += `[a${i}]`);
      // amix inputs=N:duration=longest. dropout_transition=0 helps partial overlaps??
      // normalize=0 prevents volume drop when mixing multiple inputs
      filterComplex += `amix=inputs=${clipsWithAudio.length}:duration=longest:normalize=0[aout]`;
    } else {
      // Rename single output to aout for consistency
      filterComplex += ";[a0]anull[aout]";
      // Or just map [a0] directly, but using common label is cleaner
    }
  }

  // Final encoding settings
  let preset = "ultrafast";
  let crf = "23";

  if (quality === "low") { preset = "ultrafast"; crf = "28"; }
  else if (quality === "medium") { preset = "veryfast"; crf = "23"; }
  else if (quality === "high") { preset = "superfast"; crf = "18"; }

  const outputArgs = [
    '-c:v', 'libx264',
    '-preset', preset,
    '-crf', crf,
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-y', // Overwrite output
  ];

  // Maps
  // Video
  outputArgs.push('-map', '0:v');

  // Audio
  if (clipsWithAudio.length > 0) {
    outputArgs.push('-filter_complex', filterComplex);
    outputArgs.push('-map', '[aout]');
    outputArgs.push('-c:a', 'aac'); // Encode audio
    outputArgs.push('-b:a', '192k');
  }

  outputArgs.push('output.mp4');

  // Full command
  const execArgs = [...ffmpegArgs, ...outputArgs];

  console.log("FFmpeg Command:", execArgs.join(" "));

  let exitCode = 0;
  try {
    exitCode = await ffmpeg.exec(execArgs);
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

  // Read result
  let data;
  try {
    data = await ffmpeg.readFile('output.mp4');
  } catch (e) {
    await cleanUp(ffmpeg);
    throw new Error("Failed to read output file.");
  }

  await cleanUp(ffmpeg);

  return new Blob([data as unknown as BlobPart], { type: 'video/mp4' });
}
