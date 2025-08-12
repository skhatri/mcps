export interface VersionInfo {
  latestVersion: string;
  lastUpdated: string;
  repository: string;
  excludedVersions?: string[];
  totalVersions?: number;
}

export interface CacheEntry {
  data: VersionInfo;
  timestamp: number;
  expiresAt: number;
}

export interface MavenApiResponse {
  response: {
    numFound: number;
    start: number;
    docs: MavenArtifact[];
  };
}

export interface MavenArtifact {
  id: string;
  g: string;
  a: string;
  latestVersion: string;
  repositoryId: string;
  p: string;
  timestamp: number;
  versionCount: number;
  text: string[];
  ec: string[];
}

export interface LatestVersionRequest {
  groupId: string;
  artifactId: string;
}

export interface LatestVersionResponse {
  latestVersion: string;
  lastUpdated: string;
  repository: string;
  cached: boolean;
  excludedVersions?: string[];
  totalVersions?: number;
}

export interface LogEntry {
  timestamp: string;
  type: 'REQUEST' | 'RESPONSE' | 'ERROR';
  tool: string;
  message: string;
  data?: any;
} 