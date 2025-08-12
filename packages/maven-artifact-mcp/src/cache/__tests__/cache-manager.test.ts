import { CacheManager } from '../cache-manager.js';
import { VersionInfo } from '../../types/maven.js';

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager(0.02); 
  });

  afterEach(() => {
    cacheManager.destroy();
  });

  describe('Basic Cache Operations', () => {
    it('should store and retrieve cache entries', () => {
      const versionInfo: VersionInfo = {
        latestVersion: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        repository: 'Maven Central'
      };

      cacheManager.set('org.example', 'test-artifact', versionInfo);
      const result = cacheManager.get('org.example', 'test-artifact');

      expect(result).toEqual(versionInfo);
    });

    it('should return null for non-existent cache entries', () => {
      const result = cacheManager.get('non.existent', 'artifact');
      expect(result).toBeNull();
    });

    it('should generate correct cache keys', () => {
      const versionInfo: VersionInfo = {
        latestVersion: '2.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        repository: 'Maven Central'
      };

      cacheManager.set('org.springframework', 'spring-core', versionInfo);
      const result = cacheManager.get('org.springframework', 'spring-core');

      expect(result).toEqual(versionInfo);
    });
  });

  describe('TTL and Expiration', () => {
    it('should expire entries after TTL', async () => {
      const versionInfo: VersionInfo = {
        latestVersion: '1.5.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        repository: 'Maven Central'
      };

      cacheManager.set('org.expired', 'test', versionInfo);
      
      expect(cacheManager.get('org.expired', 'test')).toEqual(versionInfo);

      await new Promise(resolve => setTimeout(resolve, 1500));

      const expiredResult = cacheManager.get('org.expired', 'test');
      expect(expiredResult).toBeNull();
    });

    it('should handle entries with different expiration times', () => {
      const versionInfo1: VersionInfo = {
        latestVersion: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        repository: 'Maven Central'
      };

      const versionInfo2: VersionInfo = {
        latestVersion: '2.0.0',
        lastUpdated: '2023-01-02T00:00:00.000Z',
        repository: 'Maven Central'
      };

      cacheManager.set('org.test1', 'artifact1', versionInfo1);
      
      setTimeout(() => {
        cacheManager.set('org.test2', 'artifact2', versionInfo2);
      }, 500);

      expect(cacheManager.get('org.test1', 'artifact1')).toEqual(versionInfo1);
    });
  });

  describe('Cache Management', () => {
    it('should clear all entries', () => {
      const versionInfo: VersionInfo = {
        latestVersion: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        repository: 'Maven Central'
      };

      cacheManager.set('org.test1', 'artifact1', versionInfo);
      cacheManager.set('org.test2', 'artifact2', versionInfo);

      expect(cacheManager.getStats().size).toBe(2);

      cacheManager.clear();

      expect(cacheManager.getStats().size).toBe(0);
      expect(cacheManager.get('org.test1', 'artifact1')).toBeNull();
      expect(cacheManager.get('org.test2', 'artifact2')).toBeNull();
    });

    it('should return correct cache statistics', () => {
      const versionInfo: VersionInfo = {
        latestVersion: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        repository: 'Maven Central'
      };

      expect(cacheManager.getStats().size).toBe(0);

      cacheManager.set('org.test', 'artifact', versionInfo);
      expect(cacheManager.getStats().size).toBe(1);

      cacheManager.set('org.test2', 'artifact2', versionInfo);
      expect(cacheManager.getStats().size).toBe(2);
    });

    it('should destroy cache manager and cleanup resources', () => {
      const versionInfo: VersionInfo = {
        latestVersion: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        repository: 'Maven Central'
      };

      cacheManager.set('org.test', 'artifact', versionInfo);
      expect(cacheManager.getStats().size).toBe(1);

      cacheManager.destroy();
      expect(cacheManager.getStats().size).toBe(0);
    });
  });

  describe('Automatic Cleanup', () => {
    it('should periodically clean up expired entries', async () => {
      const shortTtlCache = new CacheManager(0.005); 
      
      const versionInfo: VersionInfo = {
        latestVersion: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        repository: 'Maven Central'
      };

      shortTtlCache.set('org.cleanup', 'test', versionInfo);
      expect(shortTtlCache.getStats().size).toBe(1);

      await new Promise(resolve => setTimeout(resolve, 500));

      shortTtlCache.forceCleanup();
      expect(shortTtlCache.getStats().size).toBe(0);
      
      shortTtlCache.destroy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty group or artifact IDs gracefully', () => {
      const versionInfo: VersionInfo = {
        latestVersion: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        repository: 'Maven Central'
      };

      cacheManager.set('', 'artifact', versionInfo);
      const result = cacheManager.get('', 'artifact');
      expect(result).toEqual(versionInfo);

      cacheManager.set('group', '', versionInfo);
      const result2 = cacheManager.get('group', '');
      expect(result2).toEqual(versionInfo);
    });

    it('should handle special characters in keys', () => {
      const versionInfo: VersionInfo = {
        latestVersion: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        repository: 'Maven Central'
      };

      cacheManager.set('org.test-group', 'artifact_with.dots', versionInfo);
      const result = cacheManager.get('org.test-group', 'artifact_with.dots');
      expect(result).toEqual(versionInfo);
    });

    it('should handle overwriting existing cache entries', () => {
      const versionInfo1: VersionInfo = {
        latestVersion: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        repository: 'Maven Central'
      };

      const versionInfo2: VersionInfo = {
        latestVersion: '2.0.0',
        lastUpdated: '2023-01-02T00:00:00.000Z',
        repository: 'Maven Central'
      };

      cacheManager.set('org.test', 'artifact', versionInfo1);
      expect(cacheManager.get('org.test', 'artifact')).toEqual(versionInfo1);

      cacheManager.set('org.test', 'artifact', versionInfo2);
      expect(cacheManager.get('org.test', 'artifact')).toEqual(versionInfo2);
      
      expect(cacheManager.getStats().size).toBe(1);
    });

    it('should handle version info with optional fields', () => {
      const versionInfoWithExtras: VersionInfo = {
        latestVersion: '1.0.0',
        lastUpdated: '2023-01-01T00:00:00.000Z',
        repository: 'Maven Central',
        excludedVersions: ['1.0.0-RC1', '1.0.0-beta'],
        totalVersions: 15
      };

      cacheManager.set('org.test', 'artifact', versionInfoWithExtras);
      const result = cacheManager.get('org.test', 'artifact');
      expect(result).toEqual(versionInfoWithExtras);
      expect(result?.excludedVersions).toEqual(['1.0.0-RC1', '1.0.0-beta']);
      expect(result?.totalVersions).toBe(15);
    });
  });
}); 