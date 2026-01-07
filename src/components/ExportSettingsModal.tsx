import { useState, useEffect } from "react";
import { X, Download, Settings2, Zap } from "lucide-react";

export type ExportQuality = "high" | "medium" | "low";
export type ExportPreset = "ultrafast" | "veryfast" | "medium"; // FFmpeg presets

export interface ExportSettings {
  filename: string;
  width: number;
  height: number;
  fps: number;
  quality: ExportQuality;
  useHardwareAcceleration: boolean;
}

interface ExportSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (settings: ExportSettings) => void;
  defaultSettings: Partial<ExportSettings>;
  isExporting?: boolean;
}

export function ExportSettingsModal({
  isOpen,
  onClose,
  onExport,
  defaultSettings,
  isExporting = false,
}: ExportSettingsModalProps) {
  const [webCodecsSupported, setWebCodecsSupported] = useState(false);
  
  useEffect(() => {
    // Check WebCodecs support on mount
    setWebCodecsSupported(
      typeof VideoEncoder !== "undefined" &&
      typeof VideoFrame !== "undefined"
    );
  }, []);

  const [settings, setSettings] = useState<ExportSettings>({
    filename: "video-export",
    width: 1920,
    height: 1080,
    fps: 30,
    quality: "high",
    useHardwareAcceleration: true, // Default to on if supported
    ...defaultSettings,
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onExport(settings);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-white">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Settings2 size={20} />
            </div>
            <h2 className="text-lg font-semibold">Export Settings</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">Filename</label>
            <div className="flex rounded-lg border border-gray-700 bg-gray-800 overflow-hidden focus-within:border-blue-500 transition-colors">
              <input
                type="text"
                value={settings.filename}
                onChange={(e) => setSettings({ ...settings, filename: e.target.value })}
                className="flex-1 bg-transparent px-3 py-2 text-white placeholder-gray-500 focus:outline-none"
                placeholder="my-video"
                disabled={isExporting}
              />
              <div className="bg-gray-700/50 px-3 py-2 text-sm text-gray-400 border-l border-gray-700">.mp4</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400">Resolution</label>
              <select
                value={`${settings.width}x${settings.height}`}
                onChange={(e) => {
                  const [w, h] = e.target.value.split("x").map(Number);
                  setSettings({ ...settings, width: w, height: h });
                }}
                disabled={isExporting}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none appearance-none"
              >
                <option value="1920x1080">1080p (FHD)</option>
                <option value="1280x720">720p (HD)</option>
                <option value="854x480">480p (SD)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400">Framerate</label>
              <select
                value={settings.fps}
                onChange={(e) => setSettings({ ...settings, fps: Number(e.target.value) })}
                disabled={isExporting}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none appearance-none"
              >
                <option value="24">24 FPS</option>
                <option value="30">30 FPS</option>
                <option value="60">60 FPS</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">Quality / Speed</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "high", label: "High", desc: "Slower" },
                { id: "medium", label: "Standard", desc: "Balanced" },
                { id: "low", label: "Draft", desc: "Fastest" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSettings({ ...settings, quality: opt.id as ExportQuality })}
                  disabled={isExporting}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${
                    settings.quality === opt.id
                      ? "border-blue-500 bg-blue-500/10 text-blue-400"
                      : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:bg-gray-700"
                  }`}
                >
                  <span className="text-sm font-medium">{opt.label}</span>
                  <span className="text-[10px] opacity-70">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Hardware Acceleration Toggle */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Zap size={16} className={settings.useHardwareAcceleration && webCodecsSupported ? "text-yellow-400" : "text-gray-500"} />
              <div>
                <label className="text-sm font-medium text-gray-300">Hardware Acceleration</label>
                <p className="text-xs text-gray-500">
                  {webCodecsSupported ? "Use GPU for faster encoding" : "Not supported in this browser"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSettings({ ...settings, useHardwareAcceleration: !settings.useHardwareAcceleration })}
              disabled={isExporting || !webCodecsSupported}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                settings.useHardwareAcceleration && webCodecsSupported
                  ? "bg-yellow-500"
                  : "bg-gray-700"
              } ${!webCodecsSupported ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings.useHardwareAcceleration && webCodecsSupported ? "translate-x-5" : ""
                }`}
              />
            </button>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-700 text-gray-300 font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isExporting}
              className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span>Export Video</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
