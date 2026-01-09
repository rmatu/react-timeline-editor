/**
 * Storage keys for localStorage
 */
export const STORAGE_KEYS = {
  PROJECT_LIST: "video-timeline:projects",
  PROJECT_DATA_PREFIX: "video-timeline:project:",
  SCHEMA_VERSION: 1,
} as const;

/**
 * Auto-save configuration
 */
export const AUTO_SAVE_CONFIG = {
  /** Debounce delay before saving (milliseconds) */
  DEBOUNCE_MS: 2000,
  /** Force save after this duration of continuous changes (milliseconds) */
  MAX_WAIT_MS: 10000,
  /** Number of retry attempts on save failure */
  RETRY_ATTEMPTS: 3,
  /** Delay between retries (milliseconds) */
  RETRY_DELAY_MS: 1000,
} as const;

/**
 * Default project settings
 */
export const DEFAULT_PROJECT = {
  FPS: 30,
  DURATION: 60,
  RESOLUTION: { width: 1920, height: 1080 },
} as const;
