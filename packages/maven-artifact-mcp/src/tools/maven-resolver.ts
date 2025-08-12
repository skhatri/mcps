import { 
  MavenApiResponse, 
  VersionInfo, 
  LatestVersionRequest, 
  LatestVersionResponse 
} from '../types/maven.js';
import { logger } from '../logging/logger.js';
import { cacheManager } from '../cache/cache-manager.js';
import { httpClient } from '../http/http-client.js';

export class MavenResolver {
  private readonly baseUrl = 'https://search.maven.org/classic/solrsearch/select';
  private readonly timeout: number;

  constructor(timeoutMs: number = 10000) {
    this.timeout = timeoutMs;
  }

  destroy(): void {
    httpClient.destroy();
  }

  private validateInput(groupId: string, artifactId: string): void {
    if (!groupId || typeof groupId !== 'string' || groupId.trim().length === 0) {
      throw new Error('groupId is required and must be a non-empty string');
    }

    if (!artifactId || typeof artifactId !== 'string' || artifactId.trim().length === 0) {
      throw new Error('artifactId is required and must be a non-empty string');
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(groupId)) {
      throw new Error('groupId contains invalid characters');
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(artifactId)) {
      throw new Error('artifactId contains invalid characters');
    }
  }

  private isStableVersion(version: string): boolean {
    const unstablePatterns = /(preview|rc|alpha|beta|snapshot|m\d+)/i;
    return !unstablePatterns.test(version);
  }

  private compareVersions(a: string, b: string): number {
    const parseVersion = (version: string) => {
      return version.split('.').map(part => {
        const num = parseInt(part.replace(/[^\d]/g, ''), 10);
        return isNaN(num) ? 0 : num;
      });
    };

    const aParts = parseVersion(a);
    const bParts = parseVersion(b);
    const maxLength = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLength; i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart !== bPart) {
        return aPart - bPart;
      }
    }
    
    return 0;
  }

  private async getAllVersions(groupId: string, artifactId: string): Promise<string[]> {
    const versionQuery = `g:${groupId} AND a:${artifactId}`;
    
    try {
      const response = await httpClient.get(this.baseUrl, {
        query: {
          q: versionQuery,
          rows: 50,
          wt: 'json'
        },
        timeout: this.timeout
      });

      const versions: string[] = [];
      if (response.data.response && response.data.response.docs) {
        for (const doc of response.data.response.docs) {
          if (doc.v) {
            versions.push(doc.v);
          }
        }
      }
      
      return versions;
    } catch (error) {
      logger.logWarning(`Could not fetch all versions for ${groupId}:${artifactId}, falling back to latest only`);
      return [];
    }
  }

  private async queryMavenApi(groupId: string, artifactId: string): Promise<VersionInfo> {
    const query = `g:${groupId} AND a:${artifactId}`;
    
    try {
      logger.logInfo(`Querying Maven API for ${groupId}:${artifactId}`);
      
      const response = await httpClient.get<MavenApiResponse>(this.baseUrl, {
        query: {
          q: query,
          rows: 1,
          wt: 'json'
        },
        timeout: this.timeout
      });

      const { data } = response;

      if (!data.response || !data.response.docs || data.response.docs.length === 0) {
        throw new Error(`No artifacts found for ${groupId}:${artifactId}`);
      }

             const artifact = data.response.docs[0];
       if (!artifact || !artifact.latestVersion) {
         throw new Error(`No version information available for ${groupId}:${artifactId}`);
       }

       const latestVersion: string = artifact.latestVersion!;
       const excludedVersions: string[] = [];
       let finalVersion: string = latestVersion;
       let finalTimestamp: number = artifact.timestamp;

      if (this.isStableVersion(latestVersion)) {
        finalVersion = latestVersion;
        logger.logInfo(`Latest version ${latestVersion} is stable for ${groupId}:${artifactId}`);
      } else {
        excludedVersions.push(latestVersion);
        logger.logInfo(`Latest version ${latestVersion} is pre-release, fetching version history for ${groupId}:${artifactId}`);
        
        const allVersions = await this.getAllVersions(groupId, artifactId);
        const stableVersions = allVersions.filter(v => this.isStableVersion(v));
        
        if (stableVersions.length === 0) {
          const excludedInfo = ` (latest version ${latestVersion} is pre-release)`;
          throw new Error(`No stable versions found for ${groupId}:${artifactId}${excludedInfo}`);
        }

                 stableVersions.sort((a, b) => this.compareVersions(b, a));
         finalVersion = stableVersions[0]!;
        
        const unstableVersions = allVersions.filter(v => !this.isStableVersion(v));
        excludedVersions.push(...unstableVersions);
        
        logger.logInfo(`Found ${stableVersions.length} stable versions, using ${finalVersion} for ${groupId}:${artifactId}`);
      }

      const result: VersionInfo = {
        latestVersion: finalVersion,
        lastUpdated: new Date(finalTimestamp).toISOString(),
        repository: 'Maven Central'
      };

      if (excludedVersions.length > 0) {
        result.excludedVersions = [...new Set(excludedVersions)].slice(0, 10);
        result.totalVersions = excludedVersions.length + 1;
      }

      return result;
      
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Maven API timeout for ${groupId}:${artifactId}`);
      }
      
      if (error.response) {
        throw new Error(`Maven API error: ${error.response.status} ${error.response.statusText}`);
      }
      
      if (error.request) {
        throw new Error(`Maven API network error for ${groupId}:${artifactId}`);
      }
      
      throw error;
    }
  }

  async getLatestVersion(request: LatestVersionRequest): Promise<LatestVersionResponse> {
    const { groupId, artifactId } = request;
    
    this.validateInput(groupId, artifactId);

    const cachedResult = cacheManager.get(groupId, artifactId);
    if (cachedResult) {
      return {
        ...cachedResult,
        cached: true
      };
    }

    try {
      const versionInfo = await this.queryMavenApi(groupId, artifactId);
      
      cacheManager.set(groupId, artifactId, versionInfo);
      
      return {
        ...versionInfo,
        cached: false
      };
      
    } catch (error: any) {
      logger.logError('latest_version', error.message, { groupId, artifactId });
      throw error;
    }
  }
}

export const mavenResolver = new MavenResolver(); 