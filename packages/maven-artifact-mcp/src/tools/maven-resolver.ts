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
  private readonly baseUrl = 'https://repo1.maven.org/maven2';
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

  private buildMetadataUrl(groupId: string, artifactId: string): string {
    const groupPath = groupId.replace(/\./g, '/');
    return `${this.baseUrl}/${groupPath}/${artifactId}/maven-metadata.xml`;
  }

  private parseXmlVersions(xmlContent: string): { versions: string[], latest?: string, release?: string, lastUpdated?: string } {
    // Simple XML parsing for maven-metadata.xml
    const versionMatches = xmlContent.match(/<version>([^<]+)<\/version>/g);
    const versions = versionMatches ? versionMatches.map(match => match.replace(/<\/?version>/g, '')) : [];
    
    const latestMatch = xmlContent.match(/<latest>([^<]+)<\/latest>/);
    const releaseMatch = xmlContent.match(/<release>([^<]+)<\/release>/);
    const lastUpdatedMatch = xmlContent.match(/<lastUpdated>([^<]+)<\/lastUpdated>/);
    
    const result: { versions: string[], latest?: string, release?: string, lastUpdated?: string } = { versions };
    
    if (latestMatch && latestMatch[1]) {
      result.latest = latestMatch[1];
    }
    
    if (releaseMatch && releaseMatch[1]) {
      result.release = releaseMatch[1];
    }
    
    if (lastUpdatedMatch && lastUpdatedMatch[1]) {
      result.lastUpdated = lastUpdatedMatch[1];
    }
    
    return result;
  }

  private async getAllVersions(groupId: string, artifactId: string): Promise<string[]> {
    const metadataUrl = this.buildMetadataUrl(groupId, artifactId);
    
    try {
      const response = await httpClient.get(metadataUrl, {
        timeout: this.timeout,
        headers: {
          'Accept': 'application/xml'
        }
      });

      const xmlContent = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const parsedData = this.parseXmlVersions(xmlContent);
      
      return parsedData.versions || [];
    } catch (error) {
      logger.logWarning(`Could not fetch all versions for ${groupId}:${artifactId}, falling back to latest only`);
      return [];
    }
  }

  private async queryMavenApi(groupId: string, artifactId: string): Promise<VersionInfo> {
    const metadataUrl = this.buildMetadataUrl(groupId, artifactId);
    
    try {
      logger.logInfo(`Querying Maven metadata for ${groupId}:${artifactId}`);
      
      const response = await httpClient.get(metadataUrl, {
        timeout: this.timeout,
        headers: {
          'Accept': 'application/xml'
        }
      });

      const xmlContent = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const parsedData = this.parseXmlVersions(xmlContent);

      if (!parsedData.versions || parsedData.versions.length === 0) {
        throw new Error(`No versions found for ${groupId}:${artifactId}`);
      }

      // Use release version if available and stable, otherwise use latest
      let latestVersion = parsedData.release || parsedData.latest || parsedData.versions[parsedData.versions.length - 1];
      
      if (!latestVersion) {
        throw new Error(`No version information available for ${groupId}:${artifactId}`);
      }

      const allVersions = parsedData.versions;
      const excludedVersions: string[] = [];
      let finalVersion: string = latestVersion;

      if (this.isStableVersion(latestVersion)) {
        finalVersion = latestVersion;
        logger.logInfo(`Latest version ${latestVersion} is stable for ${groupId}:${artifactId}`);
      } else {
        excludedVersions.push(latestVersion);
        logger.logInfo(`Latest version ${latestVersion} is pre-release, fetching stable versions for ${groupId}:${artifactId}`);
        
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

      // Parse lastUpdated timestamp (format: yyyyMMddHHmmss)
      let lastUpdatedISO = new Date().toISOString(); // Default to now
      if (parsedData.lastUpdated && parsedData.lastUpdated.length >= 8) {
        const timestamp = parsedData.lastUpdated;
        const year = parseInt(timestamp.substring(0, 4));
        const month = parseInt(timestamp.substring(4, 6)) - 1; // Month is 0-indexed
        const day = parseInt(timestamp.substring(6, 8));
        const hour = timestamp.length >= 10 ? parseInt(timestamp.substring(8, 10)) : 0;
        const minute = timestamp.length >= 12 ? parseInt(timestamp.substring(10, 12)) : 0;
        const second = timestamp.length >= 14 ? parseInt(timestamp.substring(12, 14)) : 0;
        
        lastUpdatedISO = new Date(year, month, day, hour, minute, second).toISOString();
      }

      const result: VersionInfo = {
        latestVersion: finalVersion,
        lastUpdated: lastUpdatedISO,
        repository: 'Maven Central'
      };

      if (excludedVersions.length > 0) {
        result.excludedVersions = [...new Set(excludedVersions)].slice(0, 10);
        result.totalVersions = allVersions.length;
      }

      return result;
      
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Maven metadata timeout for ${groupId}:${artifactId}`);
      }
      
      if (error.response) {
        const status = error.response.status;
        if (status === 404) {
          throw new Error(`Artifact not found: ${groupId}:${artifactId}`);
        }
        throw new Error(`Maven metadata error: ${status} ${error.response.statusText}`);
      }
      
      if (error.request) {
        throw new Error(`Maven metadata network error for ${groupId}:${artifactId}`);
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