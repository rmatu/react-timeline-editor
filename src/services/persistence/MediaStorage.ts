/**
 * IndexedDB-based media storage for persisting video/audio files across page reloads.
 *
 * Blob URLs are temporary and only valid during a browser session.
 * This service stores the actual file data in IndexedDB and provides
 * methods to save, retrieve, and manage media files.
 */

const DB_NAME = "video-timeline-media";
const DB_VERSION = 1;
const STORE_NAME = "media-files";

interface StoredMedia {
  id: string;
  blob: Blob;
  name: string;
  type: string;
  size: number;
  createdAt: number;
}

class MediaStorageService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the IndexedDB database
   */
  async initialize(): Promise<void> {
    if (this.db) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("Failed to open IndexedDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("name", "name", { unique: false });
          store.createIndex("createdAt", "createdAt", { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Store a media file in IndexedDB
   */
  async saveMedia(id: string, file: File | Blob, name?: string): Promise<void> {
    await this.initialize();

    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const storedMedia: StoredMedia = {
        id,
        blob: file,
        name: name || (file instanceof File ? file.name : "unknown"),
        type: file.type,
        size: file.size,
        createdAt: Date.now(),
      };

      const request = store.put(storedMedia);

      request.onerror = () => {
        console.error("Failed to save media:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Retrieve a media file from IndexedDB and create a blob URL
   */
  async getMedia(id: string): Promise<{ blob: Blob; url: string; name: string } | null> {
    await this.initialize();

    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onerror = () => {
        console.error("Failed to get media:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const result = request.result as StoredMedia | undefined;
        if (result) {
          const url = URL.createObjectURL(result.blob);
          resolve({ blob: result.blob, url, name: result.name });
        } else {
          resolve(null);
        }
      };
    });
  }

  /**
   * Check if a media file exists in IndexedDB
   */
  async hasMedia(id: string): Promise<boolean> {
    await this.initialize();

    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count(IDBKeyRange.only(id));

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result > 0);
    });
  }

  /**
   * Delete a media file from IndexedDB
   */
  async deleteMedia(id: string): Promise<void> {
    await this.initialize();

    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => {
        console.error("Failed to delete media:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Get all stored media IDs
   */
  async getAllMediaIds(): Promise<string[]> {
    await this.initialize();

    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as string[]);
    });
  }

  /**
   * Clear all stored media
   */
  async clearAll(): Promise<void> {
    await this.initialize();

    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get storage usage stats
   */
  async getStorageStats(): Promise<{ count: number; totalSize: number }> {
    await this.initialize();

    if (!this.db) {
      throw new Error("Database not initialized");
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const items = request.result as StoredMedia[];
        const totalSize = items.reduce((sum, item) => sum + item.size, 0);
        resolve({ count: items.length, totalSize });
      };
    });
  }
}

// Singleton instance
export const mediaStorage = new MediaStorageService();
