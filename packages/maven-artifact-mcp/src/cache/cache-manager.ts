import { CacheEntry, VersionInfo } from '../types/maven.js';
import { logger } from '../logging/logger.js';

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly ttlMinutes: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(ttlMinutes: number = 5) {
    this.ttlMinutes = ttlMinutes;
    this.startCleanupScheduler();
  }

  private generateCacheKey(groupId: string, artifactId: string): string {
    return `${groupId}:${artifactId}`;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiresAt;
  }

  private startCleanupScheduler(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000);
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.logInfo(`Cache cleanup: removed ${removedCount} expired entries`);
    }
  }

  public forceCleanup(): void {
    this.cleanupExpiredEntries();
  }

  get(groupId: string, artifactId: string): VersionInfo | null {
    const key = this.generateCacheKey(groupId, artifactId);
    const entry = this.cache.get(key);

    if (!entry) {
      logger.logInfo(`Cache miss for ${key}`);
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      logger.logInfo(`Cache expired for ${key}`);
      return null;
    }

    logger.logInfo(`Cache hit for ${key}`);
    return entry.data;
  }

  set(groupId: string, artifactId: string, data: VersionInfo): void {
    const key = this.generateCacheKey(groupId, artifactId);
    const now = Date.now();
    const ttlMs = this.ttlMinutes * 60 * 1000;

    const entry: CacheEntry = {
      data,
      timestamp: now,
      expiresAt: now + ttlMs
    };

    this.cache.set(key, entry);
    logger.logInfo(`Cached ${key} (expires in ${this.ttlMinutes} minutes)`);
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.logInfo(`Cache cleared: removed ${size} entries`);
  }

  getStats(): { size: number; hitRate?: number } {
    return {
      size: this.cache.size
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
    logger.logInfo('Cache manager destroyed');
  }
}

export const cacheManager = new CacheManager(); 