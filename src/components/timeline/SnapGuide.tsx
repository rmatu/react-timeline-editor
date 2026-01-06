import { useAtom } from "jotai";
import { atom } from "jotai";

// Atom to store current snap guide position
export const snapGuideAtom = atom<{
  x: number;
  type: string;
  visible: boolean;
}>({
  x: 0,
  type: "",
  visible: false,
});

export function SnapGuide() {
  const [snapGuide] = useAtom(snapGuideAtom);

  if (!snapGuide.visible) return null;

  return (
    <div
      className="snap-guide pointer-events-none absolute top-0 bottom-0 z-40"
      style={{
        left: snapGuide.x,
        transform: "translateX(-50%)",
      }}
    >
      {/* Snap line */}
      <div className="h-full w-0.5 bg-yellow-400/80" />

      {/* Snap type indicator */}
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-yellow-500 px-1.5 py-0.5 text-[10px] font-medium text-black">
        {snapGuide.type}
      </div>

      {/* Animated dots along the line */}
      <div className="absolute inset-0 flex flex-col items-center justify-around">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-yellow-400"
            style={{
              animation: `snap-pulse 0.5s ease-in-out ${i * 0.1}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Helper function to show snap guide
export function showSnapGuide(
  setSnapGuide: (value: { x: number; type: string; visible: boolean }) => void,
  x: number,
  type: string
) {
  setSnapGuide({ x, type, visible: true });

  // Trigger haptic feedback if available
  if ("vibrate" in navigator) {
    navigator.vibrate(10);
  }
}

// Helper function to hide snap guide
export function hideSnapGuide(
  setSnapGuide: (value: { x: number; type: string; visible: boolean }) => void
) {
  setSnapGuide({ x: 0, type: "", visible: false });
}
