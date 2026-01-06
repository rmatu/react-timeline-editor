import { useState, useEffect, useRef } from "react";

interface WaveformOptions {
  samples?: number;
}

export function useAudioWaveform(url: string, options: WaveformOptions = {}) {
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!url) return;

    const fetchAndDecode = async () => {
      setIsLoading(true);
      setError(null);

      // Cancel previous request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await fetch(url, { signal: abortController.signal });
        const arrayBuffer = await response.arrayBuffer();

        if (abortController.signal.aborted) return;

        // Use standard Web Audio API to decode
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const rawData = audioBuffer.getChannelData(0); // Use the first channel
        const samples = options.samples || 100; // Default number of samples
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData: number[] = [];

        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            // Use RMS (Root Mean Square) for a better representation of loudness
            sum += Math.abs(rawData[blockSize * i + j]);
          }
          filteredData.push(sum / blockSize);
        }

        // Normalize
        const multiplier = Math.pow(Math.max(...filteredData), -1);
        const normalizedData = filteredData.map((n) => n * multiplier);

        setWaveformData(normalizedData);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Error generating waveform:", err);
        setError(err);
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchAndDecode();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [url, options.samples]);

  return { waveformData, error, isLoading };
}
