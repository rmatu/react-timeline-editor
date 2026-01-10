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
  const canvasBackground = useTimelineStore((state) => state.canvasBackground);

  const selectBackground = useTimelineStore((state) => state.selectBackground);

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

  // Calculate max track order once for z-index strategy
  const maxTrackOrder = useMemo(() => {
    let max = 0;
    tracks.forEach(t => { if (t.order > max) max = t.order; });
    return max;
  }, [tracks]);



  return (
    <PlayerWrapper
      resolution={resolution}
      className={className}
      onClick={(e) => {
        // If clicking the empty background (PlayerWrapper container), select background
        if (e.target === e.currentTarget) {
          selectBackground();
        }
      }}
    >
      {({ playerRef }) => {
        // Background Styles
        const backgroundStyle: React.CSSProperties = {
            backgroundColor: canvasBackground.type === "color" ? canvasBackground.color : "black",
        };

        return (
        <>
          {/* Player container */}
          <div
            ref={playerRef}
            className="relative w-full h-full overflow-hidden shadow-2xl cursor-pointer"
            style={backgroundStyle}
            onClick={(e) => {
              // Select background if clicking container background
              if (e.target === e.currentTarget) {
                if (activeVideoClip) {
                    // This case is tricky: if there is a video clip filling the screen, 
                    // changing background won't be visible unless video is transparent or smaller.
                    // But if they click the VIDEO, they probably want to select the VIDEO clip.
                    // But if they click OFF the video (letterbox area), they want background.
                    // The player container logic is: content is centered. 
                    // BUT VideoPreview actually renders video elements inside. 
                    
                    // If e.target === e.currentTarget, it means they clicked the "black bars" or the container itself.
                    // If video fills container, they can't click container.
                    // But if video is small (transformed), they can click container.
                    
                    // Logic: If clicking container, and we have an active video clip, current logic selects it?
                    // No. Original logic was:
                    // if (activeVideoClip) selectClip(activeVideoClip.id)
                    // This implies the container was acting as the click target FOR the video.
                    // But now we want to distinguish "Background" vs "Content".
                    
                    // Let's keep it simple: clicking the "Container" selects the Background.
                    // To select the video, they must click the VIDEO (DraggableVideoLayer).
                    // BUT DraggableVideoLayer has 'pointer-events-auto'? Yes.
                    
                    // The original code had:
                    // if (activeVideoClip) selectClip(...) else deselectAll()
                    // This meant clicking ANYWHERE in the player selected the active video clip.
                    // We must change this so that clicking the BACKGROUND selects the background.
                    // But we still want easy selection of the video.
                    
                    // Compromise: 
                    // If they click the container, we check if they clicked "on" the video content? 
                    // Hard to know without hit testing.
                    // 
                    // Let's change behavior: 
                    // Clicking container -> selectBackground().
                    // To select video, they must click the video layer.
                    // Since DraggableVideoLayer is rendered separately, check if it captures clicks.
                    // DraggableVideoLayer usually handles its own clicks/drags.
                    
                    // So:
                    selectBackground();
                } else {
                   selectBackground();
                }
              }
            }}
          >
            {/* Background Image Layer */}
            {canvasBackground.type === "image" && canvasBackground.url && (
                <div 
                    className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat pointer-events-none"
                    style={{ backgroundImage: `url(${canvasBackground.url})` }}
                />
            )}

            {/* Background Blur Layer */}
            {canvasBackground.type === "blur" && activeVideoClip && (
              <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
                {/* 
                   We duplicate the active video logic here for the blur background. 
                   We need to ensure it syncs. Since <AudioLayer> drives the "real" audio, 
                   this video element is just for display.
                   We rely on the main video rendering to drive the visual? 
                   No, we need to render the video frame here too.
                   We can just render a <video> that syncs to currentTime.
                */}
                <video
                    src={activeVideoClip.sourceUrl}
                    className="w-full h-full object-cover filter blur-xl scale-110 opacity-50"
                    style={{ 
                        filter: `blur(${Math.max(0, canvasBackground.blurAmount ?? 0) * 0.5}px)` 
                    }}
                    muted
                    ref={(el) => {
                        if (el) {
                            // Simple sync - might jitter but acceptable for background
                            if (Math.abs(el.currentTime - (currentTime - activeVideoClip.startTime + activeVideoClip.sourceStartTime)) > 0.3) {
                                el.currentTime = Math.max(0, currentTime - activeVideoClip.startTime + activeVideoClip.sourceStartTime);
                            }
                            if (isPlaying && el.paused) el.play().catch(() => {});
                            if (!isPlaying && !el.paused) el.pause();
                            el.playbackRate = activeVideoClip.playbackRate || 1;
                        }
                    }}
                />
              </div>
            )}

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
              // Use pre-calculated maxTrackOrder. Fallback to maxTrackOrder (bottom) if track is missing.
              const zIndex = Z_INDEX.PREVIEW.CONTENT_BASE + (maxTrackOrder - (track?.order ?? maxTrackOrder));

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
      )}}
    </PlayerWrapper>
  );
}
