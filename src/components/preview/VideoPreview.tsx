import { useRef, useEffect, useMemo, memo } from "react";
import { useTimelineStore } from "@/stores/timelineStore";
import { TextOverlay } from "./TextOverlay";
import { ImageOverlay } from "./ImageOverlay";
import { PlayerWrapper } from "./PlayerWrapper";
import { DraggableVideoLayer } from "./DraggableVideoLayer";
import type { VideoPreviewProps } from "@/types";
import type { VideoClip, AudioClip } from "@/schemas";
import { getAnimatedPropertiesAtTime } from "@/utils/keyframes";
import { Z_INDEX } from "@/constants/timeline.constants";



const AudioLayer = memo(({
  clip,
  isActive,
  isPlaying,
  currentTime,
  trackMuted,
}: {
  clip: AudioClip | VideoClip,
  isActive: boolean,
  isPlaying: boolean,
  currentTime: number,
  trackMuted: boolean
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Get animated volume
  const animated = useMemo(
    () => getAnimatedPropertiesAtTime(clip, currentTime),
    [clip, currentTime]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // 1. Mute/Volume - use animated volume if available
    audio.muted = !isActive || clip.muted || trackMuted;
    audio.volume = animated.volume ?? clip.volume;
    
    // Handle playbackRate for video clips
    const playbackRate = clip.type === 'video' ? clip.playbackRate : 1;
    audio.playbackRate = playbackRate;

    // 2. Playback State
    if (isActive && isPlaying) {
      audio.play().catch(() => {
        // Autoplay restrictions
      });
    } else {
      audio.pause();
    }

    // 3. Time Sync - account for playbackRate on video clips
    const targetAudioTime = clip.sourceStartTime + (currentTime - clip.startTime) * playbackRate;
    
    const timeDiff = Math.abs(audio.currentTime - targetAudioTime);
    
    if (!isPlaying || timeDiff > 0.2) {
      if (Number.isFinite(targetAudioTime)) {
         audio.currentTime = targetAudioTime;
      }
    }
  }, [isActive, isPlaying, clip, currentTime, trackMuted, animated]);

  return (
    <audio
      ref={audioRef}
      src={clip.sourceUrl}
      className="hidden"
      preload="auto"
      onEnded={() => { /* Loop or stop? defaults to stop */ }}
    />
  );
});

AudioLayer.displayName = "AudioLayer";

export function VideoPreview({
  currentTime,
  isPlaying,
  onTimeUpdate,
  className,
}: VideoPreviewProps) {
  const clips = useTimelineStore((state) => state.clips);
  const tracks = useTimelineStore((state) => state.tracks);
  const resolution = useTimelineStore((state) => state.resolution);
  const selectClip = useTimelineStore((state) => state.selectClip);
  const deselectAll = useTimelineStore((state) => state.deselectAll);

  // Get all video clips sorted by track order (top track = lower order = higher priority)
  const videoClips = useMemo(() => {
    const videos = Array.from(clips.values()).filter((c): c is VideoClip => c.type === "video");
    // Sort by track order (ascending) so top tracks come first
    return videos.sort((a, b) => {
      const trackA = tracks.get(a.trackId);
      const trackB = tracks.get(b.trackId);
      return (trackA?.order ?? 999) - (trackB?.order ?? 999);
    });
  }, [clips, tracks]);

  // Find the active video clip at current time (top track wins)
  const activeVideoClip = useMemo(() => 
    videoClips.find(
      (clip) =>
        currentTime >= clip.startTime &&
        currentTime < clip.startTime + clip.duration &&
        tracks.get(clip.trackId)?.visible !== false
    ),
    [videoClips, currentTime, tracks]
  );



  return (
    <PlayerWrapper
      resolution={resolution}
      className={className}
      onClick={(e) => {
        // Deselect if clicking the empty background (PlayerWrapper container)
        if (e.target === e.currentTarget) {
          deselectAll();
        }
      }}
    >
      {({ playerRef }) => (
        <>
          {/* Player container - has overflow:hidden for video content only */}
          <div
            ref={playerRef}
            className="relative w-full h-full overflow-hidden rounded-lg bg-black shadow-2xl cursor-pointer"
            onClick={(e) => {
              // Only select if clicking directly on container (not on text overlay)
              if (e.target === e.currentTarget) {
                if (activeVideoClip) {
                  selectClip(activeVideoClip.id, e.shiftKey);
                } else {
                  deselectAll();
                }
              }
            }}
          >
            {/* Render all audio clips AND video clip audio */}
            {Array.from(clips.values())
              .filter((c): c is AudioClip | VideoClip => c.type === "audio" || c.type === "video")
              .map((clip) => {
                 const track = tracks.get(clip.trackId);
                 const isActive = currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration && track?.visible !== false;
                 return (
                  <AudioLayer
                    key={`audio-${clip.id}`}
                    clip={clip}
                    isActive={isActive}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    trackMuted={track?.muted ?? false}
                  />
                );
              })}

            {/* Playback indicator overlay */}
            {isPlaying && activeVideoClip && (
              <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/50 px-2 py-1 text-xs text-white z-20">
                <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                Playing
              </div>
            )}
          </div>

          {/* Video overlays - OUTSIDE player's overflow:hidden so handles aren't clipped */}
          {videoClips
            .filter(clip => tracks.get(clip.trackId)?.visible !== false)
            .map((clip) => {
              const track = tracks.get(clip.trackId);
              let maxOrder = 0;
              tracks.forEach(t => { if (t.order > maxOrder) maxOrder = t.order; });
              const zIndex = Z_INDEX.PREVIEW.CONTENT_BASE + (maxOrder - (track?.order ?? 0));

              return (
                <DraggableVideoLayer
                  key={clip.id}
                  clip={clip}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  containerRef={playerRef}
                  onTimeUpdate={onTimeUpdate}
                  zIndex={zIndex}
                />
              );
            })}

          {/* Image/sticker overlays - positioned relative to player */}
          <ImageOverlay currentTime={currentTime} containerRef={playerRef} />

          {/* Text overlays - OUTSIDE player's overflow:hidden, but positioned relative to it */}
          <TextOverlay currentTime={currentTime} containerRef={playerRef} />
        </>
      )}
    </PlayerWrapper>
  );
}
