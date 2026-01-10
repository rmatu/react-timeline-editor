import { useTimelineStore } from "@/stores/timelineStore";
import { CanvasBackground } from "@/stores/timelineStore";
import { PaintBucket, Droplets, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Valid patterns/images for background
const PATTERNS = [
  "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=300&q=80",
  "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=300&q=80",
  "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=300&q=80",
  "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=300&q=80",
];

// Predefined colors
const COLORS = [
  "#000000", "#FFFFFF", "#EF4444", "#F97316", "#EAB308", 
  "#22C55E", "#3B82F6", "#A855F7", "#EC4899", "#14B8A6", 
  "#6366F1", "#64748B",
];

type TabType = CanvasBackground["type"];

export function BackgroundProperties() {
  const canvasBackground = useTimelineStore((state) => state.canvasBackground);
  const setCanvasBackground = useTimelineStore((state) => state.setCanvasBackground);
  
  // Use state from store essentially, but for UI we might want to switch tabs without changing type immediately?
  // Actually standard CapCut behavior: clicking tab switches mode.
  const activeTab = canvasBackground.type;

  const handleTypeChange = (type: TabType) => {
    setCanvasBackground({ type });
  };

  const handleColorChange = (color: string) => {
    setCanvasBackground({ type: "color", color });
  };

  const handleImageChange = (url: string) => {
    setCanvasBackground({ type: "image", url });
  };

  const handleBlurChange = (amount: number) => {
    setCanvasBackground({ type: "blur", blurAmount: amount });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-100">Background</h3>
      </div>

      <div className="w-full">
        <div className="grid w-full grid-cols-3 bg-zinc-800 rounded-md p-1 mb-4">
          <button
            onClick={() => handleTypeChange("blur")}
             className={cn(
              "flex items-center justify-center py-1.5 rounded-sm text-sm font-medium transition-all",
              activeTab === "blur" ? "bg-zinc-600 text-white shadow" : "text-zinc-400 hover:text-zinc-100"
            )}
            title="Blur"
          >
            <Droplets className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleTypeChange("color")}
            className={cn(
              "flex items-center justify-center py-1.5 rounded-sm text-sm font-medium transition-all",
              activeTab === "color" ? "bg-zinc-600 text-white shadow" : "text-zinc-400 hover:text-zinc-100"
            )}
            title="Color"
          >
            <PaintBucket className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleTypeChange("image")}
             className={cn(
              "flex items-center justify-center py-1.5 rounded-sm text-sm font-medium transition-all",
              activeTab === "image" ? "bg-zinc-600 text-white shadow" : "text-zinc-400 hover:text-zinc-100"
            )}
            title="Image"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
        </div>

        {/* COLOR TAB */}
        {activeTab === "color" && (
          <div className="space-y-4 pt-2">
            <div className="space-y-3">
              <label className="text-xs text-zinc-400">Custom Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={canvasBackground.color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="h-10 w-full cursor-pointer rounded border border-zinc-700 bg-zinc-800 p-1"
                />
              </div>
              
              <label className="text-xs text-zinc-400">Presets</label>
              <div className="grid grid-cols-6 gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => handleColorChange(color)}
                    className={cn(
                      "h-8 w-full rounded border border-zinc-700 transition-transform active:scale-95",
                      canvasBackground.color === color && canvasBackground.type === "color" && "ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-900"
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BLUR TAB */}
        {activeTab === "blur" && (
          <div className="space-y-4 pt-2">
            <p className="text-xs text-zinc-400 mb-4">
              Applies a blur effect to the video content to fill the background.
            </p>
            
            <div className="grid grid-cols-4 gap-3">
              {[0, 25, 50, 75, 100].map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleBlurChange(amount)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-2 hover:bg-zinc-800 transition-colors",
                    canvasBackground.blurAmount === amount && "border-blue-500 bg-zinc-800"
                  )}
                >
                  <div className="relative h-12 w-full overflow-hidden rounded bg-zinc-800">
                      <div 
                          className="absolute inset-0 bg-zinc-600" 
                          style={{ filter: `blur(${amount * 0.1}px)` }}
                      >
                           <div className="absolute inset-0 flex items-center justify-center text-[8px] text-white/50">VIDEO</div>
                      </div>
                  </div>
                  <span className="text-xs text-zinc-400">{amount === 0 ? "None" : `${amount}%`}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* IMAGE TAB */}
        {activeTab === "image" && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                  onClick={() => setCanvasBackground({ type: "color" })}
                  className={cn(
                    "aspect-square rounded border border-zinc-700 bg-zinc-800 flex items-center justify-center hover:bg-zinc-700",
                    canvasBackground.type !== "image" && "ring-2 ring-blue-500/50"
                   )}
                   title="No Image"
              >
                  <span className="text-xs text-zinc-400">None</span>
              </button>
              
              {PATTERNS.map((url, i) => (
                <button
                  key={i}
                  onClick={() => handleImageChange(url)}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded border border-transparent transition-all hover:scale-105",
                    canvasBackground.url === url && "ring-2 ring-blue-500 ring-offset-2 ring-offset-zinc-900"
                  )}
                >
                  <img src={url} alt="Background" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            <div className="pt-2">
               <p className="text-xs text-zinc-500">
                  Select a background pattern.
               </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
