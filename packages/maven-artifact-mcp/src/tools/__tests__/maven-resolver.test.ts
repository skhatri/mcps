import { MavenResolver } from '../maven-resolver.js';
import { MavenApiResponse } from '../../types/maven.js';
import { httpClient } from '../../http/http-client.js';

jest.mock('../../http/http-client.js');
const mockedHttpClient = httpClient as jest.Mocked<typeof httpClient>;

// Helper function to create mock HTTP responses
const createMockHttpResponse = (data: any) => ({
  data,
  status: 200,
  headers: { 'content-type': 'application/json' }
});

jest.mock('../../logging/logger.js', () => ({
  logger: {
    logInfo: jest.fn(),
    logWarning: jest.fn(),
    logError: jest.fn()
  }
}));

jest.mock('../../cache/cache-manager.js', () => ({
  cacheManager: {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn()
  }
}));

describe('MavenResolver', () => {
  let resolver: MavenResolver;

  beforeEach(() => {
    resolver = new MavenResolver();
    jest.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should validate required groupId', async () => {
      await expect(
        resolver.getLatestVersion({ groupId: '', artifactId: 'spring-core' })
      ).rejects.toThrow('groupId is required and must be a non-empty string');
    });

    it('should validate required artifactId', async () => {
      await expect(
        resolver.getLatestVersion({ groupId: 'org.springframework', artifactId: '' })
      ).rejects.toThrow('artifactId is required and must be a non-empty string');
    });

    it('should validate groupId format', async () => {
      await expect(
        resolver.getLatestVersion({ groupId: 'invalid@group', artifactId: 'spring-core' })
      ).rejects.toThrow('groupId contains invalid characters');
    });

    it('should validate artifactId format', async () => {
      await expect(
        resolver.getLatestVersion({ groupId: 'org.springframework', artifactId: 'invalid@artifact' })
      ).rejects.toThrow('artifactId contains invalid characters');
    });

    it('should accept valid group and artifact IDs', async () => {
      const mockResponse: MavenApiResponse = {
        response: {
          numFound: 1,
          start: 0,
          docs: [{
            id: 'org.springframework:spring-core:6.0.0',
            g: 'org.springframework',
            a: 'spring-core',
            latestVersion: '6.0.0',
            repositoryId: 'central',
            p: 'jar',
            timestamp: 1699267845000,
            versionCount: 100,
            text: ['org.springframework', 'spring-core'],
            ec: ['.jar', '.pom']
          }]
        }
      };

      mockedHttpClient.get.mockResolvedValueOnce(createMockHttpResponse(mockResponse));

      const result = await resolver.getLatestVersion({
        groupId: 'org.springframework',
        artifactId: 'spring-core'
      });

      expect(result).toBeDefined();
      expect(result.latestVersion).toBe('6.0.0');
    });
  });

  describe('Version Filtering', () => {
    it('should return stable version when latest is stable', async () => {
      const mockResponse: MavenApiResponse = {
        response: {
          numFound: 1,
          start: 0,
          docs: [{
            id: 'org.springframework:spring-core:6.0.0',
            g: 'org.springframework',
            a: 'spring-core',
            latestVersion: '6.0.0',
            repositoryId: 'central',
            p: 'jar',
            timestamp: 1699267845000,
            versionCount: 100,
            text: ['org.springframework', 'spring-core'],
            ec: ['.jar', '.pom']
          }]
        }
      };

      mockedHttpClient.get.mockResolvedValueOnce(createMockHttpResponse(mockResponse));

      const result = await resolver.getLatestVersion({
        groupId: 'org.springframework',
        artifactId: 'spring-core'
      });

      expect(result.latestVersion).toBe('6.0.0');
      expect(result.cached).toBe(false);
    });

    it('should filter out preview versions', async () => {
      const mockMainResponse: MavenApiResponse = {
        response: {
          numFound: 1,
          start: 0,
          docs: [{
            id: 'org.test:artifact:2.0.0-preview1',
            g: 'org.test',
            a: 'artifact',
            latestVersion: '2.0.0-preview1',
            repositoryId: 'central',
            p: 'jar',
            timestamp: 1699267845000,
            versionCount: 8,
            text: ['org.test', 'artifact'],
            ec: ['.jar', '.pom']
          }]
        }
      };

      const mockVersionsResponse = {
        response: {
          numFound: 8,
          start: 0,
          docs: [
            { v: '2.0.0-preview1' },
            { v: '2.0.0-RC1' },
            { v: '1.9.0-alpha1' },
            { v: '1.8.0-beta2' },
            { v: '1.7.0-M1' },
            { v: '1.6.0-SNAPSHOT' },
            { v: '1.5.0' },
            { v: '1.4.0' }
          ]
        }
      };

      mockedHttpClient.get
        .mockResolvedValueOnce(createMockHttpResponse(mockMainResponse))
        .mockResolvedValueOnce(createMockHttpResponse(mockVersionsResponse));

      const result = await resolver.getLatestVersion({
        groupId: 'org.test',
        artifactId: 'artifact'
      });

      expect(result.latestVersion).toBe('1.5.0');
      expect(result.excludedVersions).toContain('2.0.0-preview1');
      expect(result.excludedVersions).toContain('2.0.0-RC1');
      expect(result.excludedVersions).toContain('1.9.0-alpha1');
      expect(result.excludedVersions).toContain('1.8.0-beta2');
      expect(result.excludedVersions).toContain('1.7.0-M1');
      expect(result.excludedVersions).toContain('1.6.0-SNAPSHOT');
      expect(result.totalVersions).toBe(8);
    });

    it('should filter out RC versions', async () => {
      const mockMainResponse: MavenApiResponse = {
        response: {
          numFound: 1,
          start: 0,
          docs: [{
            id: 'org.test:artifact:2.0.0-RC1',
            g: 'org.test',
            a: 'artifact',
            latestVersion: '2.0.0-RC1',
            repositoryId: 'central',
            p: 'jar',
            timestamp: 1699267845000,
            versionCount: 3,
            text: ['org.test', 'artifact'],
            ec: ['.jar', '.pom']
          }]
        }
      };

      const mockVersionsResponse = {
        response: {
          numFound: 3,
          start: 0,
          docs: [
            { v: '2.0.0-RC1' },
            { v: '1.9.0' },
            { v: '1.8.0' }
          ]
        }
      };

      mockedHttpClient.get
        .mockResolvedValueOnce(createMockHttpResponse(mockMainResponse))
        .mockResolvedValueOnce(createMockHttpResponse(mockVersionsResponse));

      const result = await resolver.getLatestVersion({
        groupId: 'org.test',
        artifactId: 'artifact'
      });

      expect(result.latestVersion).toBe('1.9.0');
      expect(result.excludedVersions).toContain('2.0.0-RC1');
    });

    it('should filter out milestone versions', async () => {
      const mockMainResponse: MavenApiResponse = {
        response: {
          numFound: 1,
          start: 0,
          docs: [{
            id: 'org.springframework:spring-core:7.0.0-M1',
            g: 'org.springframework',
            a: 'spring-core',
            latestVersion: '7.0.0-M1',
            repositoryId: 'central',
            p: 'jar',
            timestamp: 1699267845000,
            versionCount: 4,
            text: ['org.springframework', 'spring-core'],
            ec: ['.jar', '.pom']
          }]
        }
      };

      const mockVersionsResponse = {
        response: {
          numFound: 4,
          start: 0,
          docs: [
            { v: '7.0.0-M1' },
            { v: '6.1.0' },
            { v: '6.0.0' },
            { v: '5.9.0' }
          ]
        }
      };

      mockedHttpClient.get
        .mockResolvedValueOnce(createMockHttpResponse(mockMainResponse))
        .mockResolvedValueOnce(createMockHttpResponse(mockVersionsResponse));

      const result = await resolver.getLatestVersion({
        groupId: 'org.springframework',
        artifactId: 'spring-core'
      });

      expect(result.latestVersion).toBe('6.1.0');
      expect(result.excludedVersions).toContain('7.0.0-M1');
    });

    it('should filter out SNAPSHOT versions', async () => {
      const mockMainResponse: MavenApiResponse = {
        response: {
          numFound: 1,
          start: 0,
          docs: [{
            id: 'org.test:artifact:2.0.0-SNAPSHOT',
            g: 'org.test',
            a: 'artifact',
            latestVersion: '2.0.0-SNAPSHOT',
            repositoryId: 'central',
            p: 'jar',
            timestamp: 1699267845000,
            versionCount: 3,
            text: ['org.test', 'artifact'],
            ec: ['.jar', '.pom']
          }]
        }
      };

      const mockVersionsResponse = {
        response: {
          numFound: 3,
          start: 0,
          docs: [
            { v: '2.0.0-SNAPSHOT' },
            { v: '1.5.0' },
            { v: '1.4.0' }
          ]
        }
      };

      mockedHttpClient.get
        .mockResolvedValueOnce(createMockHttpResponse(mockMainResponse))
        .mockResolvedValueOnce(createMockHttpResponse(mockVersionsResponse));

      const result = await resolver.getLatestVersion({
        groupId: 'org.test',
        artifactId: 'artifact'
      });

      expect(result.latestVersion).toBe('1.5.0');
      expect(result.excludedVersions).toContain('2.0.0-SNAPSHOT');
    });

    it('should filter out alpha and beta versions', async () => {
      const mockMainResponse: MavenApiResponse = {
        response: {
          numFound: 1,
          start: 0,
          docs: [{
            id: 'org.test:artifact:2.0.0-beta1',
            g: 'org.test',
            a: 'artifact',
            latestVersion: '2.0.0-beta1',
            repositoryId: 'central',
            p: 'jar',
            timestamp: 1699267845000,
            versionCount: 4,
            text: ['org.test', 'artifact'],
            ec: ['.jar', '.pom']
          }]
        }
      };

      const mockVersionsResponse = {
        response: {
          numFound: 4,
          start: 0,
          docs: [
            { v: '2.0.0-beta1' },
            { v: '2.0.0-alpha3' },
            { v: '1.9.0' },
            { v: '1.8.0' }
          ]
        }
      };

      mockedHttpClient.get
        .mockResolvedValueOnce(createMockHttpResponse(mockMainResponse))
        .mockResolvedValueOnce(createMockHttpResponse(mockVersionsResponse));

      const result = await resolver.getLatestVersion({
        groupId: 'org.test',
        artifactId: 'artifact'
      });

      expect(result.latestVersion).toBe('1.9.0');
      expect(result.excludedVersions).toContain('2.0.0-beta1');
      expect(result.excludedVersions).toContain('2.0.0-alpha3');
    });

    it('should throw error when no stable versions found', async () => {
      const mockMainResponse: MavenApiResponse = {
        response: {
          numFound: 1,
          start: 0,
          docs: [{
            id: 'org.test:artifact:1.0.0-RC1',
            g: 'org.test',
            a: 'artifact',
            latestVersion: '1.0.0-RC1',
            repositoryId: 'central',
            p: 'jar',
            timestamp: 1699267845000,
            versionCount: 2,
            text: ['org.test', 'artifact'],
            ec: ['.jar', '.pom']
          }]
        }
      };

      const mockVersionsResponse = {
        response: {
          numFound: 2,
          start: 0,
          docs: [
            { v: '1.0.0-RC1' },
            { v: '1.0.0-beta1' }
          ]
        }
      };

      mockedHttpClient.get
        .mockResolvedValueOnce(createMockHttpResponse(mockMainResponse))
        .mockResolvedValueOnce(createMockHttpResponse(mockVersionsResponse));

      await expect(
        resolver.getLatestVersion({ groupId: 'org.test', artifactId: 'artifact' })
      ).rejects.toThrow('No stable versions found for org.test:artifact (latest version 1.0.0-RC1 is pre-release)');
    });
  });

  describe('Version Comparison', () => {
    it('should correctly sort semantic versions', async () => {
      const mockMainResponse: MavenApiResponse = {
        response: {
          numFound: 1,
          start: 0,
          docs: [{
            id: 'org.test:artifact:3.0.0-RC1',
            g: 'org.test',
            a: 'artifact',
            latestVersion: '3.0.0-RC1',
            repositoryId: 'central',
            p: 'jar',
            timestamp: 1699267845000,
            versionCount: 5,
            text: ['org.test', 'artifact'],
            ec: ['.jar', '.pom']
          }]
        }
      };

      const mockVersionsResponse = {
        response: {
          numFound: 5,
          start: 0,
          docs: [
            { v: '3.0.0-RC1' },
            { v: '2.10.1' },
            { v: '2.9.0' },
            { v: '2.10.0' },
            { v: '2.8.0' }
          ]
        }
      };

      mockedHttpClient.get
        .mockResolvedValueOnce(createMockHttpResponse(mockMainResponse))
        .mockResolvedValueOnce(createMockHttpResponse(mockVersionsResponse));

      const result = await resolver.getLatestVersion({
        groupId: 'org.test',
        artifactId: 'artifact'
      });

      expect(result.latestVersion).toBe('2.10.1');
    });

    it('should handle different version formats', async () => {
      const mockMainResponse: MavenApiResponse = {
        response: {
          numFound: 1,
          start: 0,
          docs: [{
            id: 'org.test:artifact:2.0-RC1',
            g: 'org.test',
            a: 'artifact',
            latestVersion: '2.0-RC1',
            repositoryId: 'central',
            p: 'jar',
            timestamp: 1699267845000,
            versionCount: 4,
            text: ['org.test', 'artifact'],
            ec: ['.jar', '.pom']
          }]
        }
      };

      const mockVersionsResponse = {
        response: {
          numFound: 4,
          start: 0,
          docs: [
            { v: '2.0-RC1' },
            { v: '1.9' },
            { v: '1.8.1' },
            { v: '1.8' }
          ]
        }
      };

      mockedHttpClient.get
        .mockResolvedValueOnce(createMockHttpResponse(mockMainResponse))
        .mockResolvedValueOnce(createMockHttpResponse(mockVersionsResponse));

      const result = await resolver.getLatestVersion({
        groupId: 'org.test',
        artifactId: 'artifact'
      });

      expect(result.latestVersion).toBe('1.9');
    });
  });

  describe('API Error Handling', () => {
    it('should handle network timeout', async () => {
      const timeoutError = new Error('timeout');
      (timeoutError as any).code = 'ECONNABORTED';
      mockedHttpClient.get.mockRejectedValueOnce(timeoutError);

      await expect(
        resolver.getLatestVersion({ groupId: 'org.test', artifactId: 'artifact' })
      ).rejects.toThrow('Maven API timeout for org.test:artifact');
    });

    it('should handle HTTP error responses', async () => {
      const httpError = {
        response: {
          status: 500,
          statusText: 'Internal Server Error'
        }
      };
      mockedHttpClient.get.mockRejectedValueOnce(httpError);

      await expect(
        resolver.getLatestVersion({ groupId: 'org.test', artifactId: 'artifact' })
      ).rejects.toThrow('Maven API error: 500 Internal Server Error');
    });

    it('should handle network errors', async () => {
      const networkError = {
        request: {}
      };
      mockedHttpClient.get.mockRejectedValueOnce(networkError);

      await expect(
        resolver.getLatestVersion({ groupId: 'org.test', artifactId: 'artifact' })
      ).rejects.toThrow('Maven API network error for org.test:artifact');
    });

    it('should handle generic errors', async () => {
      const genericError = new Error('Something unexpected happened');
      mockedHttpClient.get.mockRejectedValueOnce(genericError);

      await expect(
        resolver.getLatestVersion({ groupId: 'org.test', artifactId: 'artifact' })
      ).rejects.toThrow('Something unexpected happened');
    });

    it('should handle empty API response', async () => {
      const emptyResponse: MavenApiResponse = {
        response: {
          numFound: 0,
          start: 0,
          docs: []
        }
      };

      mockedHttpClient.get.mockResolvedValueOnce(createMockHttpResponse(emptyResponse));

      await expect(
        resolver.getLatestVersion({ groupId: 'org.nonexistent', artifactId: 'artifact' })
      ).rejects.toThrow('No artifacts found for org.nonexistent:artifact');
    });

    it('should handle malformed API response', async () => {
      const malformedResponse = {
        response: {
          numFound: 1,
          start: 0,
          docs: [{
            id: 'org.test:artifact',
            g: 'org.test',
            a: 'artifact'
          }]
        }
      };

      mockedHttpClient.get.mockResolvedValueOnce(createMockHttpResponse(malformedResponse));

      await expect(
        resolver.getLatestVersion({ groupId: 'org.test', artifactId: 'artifact' })
      ).rejects.toThrow('No version information available for org.test:artifact');
    });
  });

  describe('API Request Configuration', () => {
    it('should make API request with correct parameters', async () => {
      const mockResponse: MavenApiResponse = {
        response: {
          numFound: 1,
          start: 0,
          docs: [{
            id: 'org.springframework:spring-core:6.0.0',
            g: 'org.springframework',
            a: 'spring-core',
            latestVersion: '6.0.0',
            repositoryId: 'central',
            p: 'jar',
            timestamp: 1699267845000,
            versionCount: 100,
            text: ['org.springframework', 'spring-core'],
            ec: ['.jar', '.pom']
          }]
        }
      };

      mockedHttpClient.get.mockResolvedValueOnce(createMockHttpResponse(mockResponse));

      await resolver.getLatestVersion({
        groupId: 'org.springframework',
        artifactId: 'spring-core'
      });

      expect(mockedHttpClient.get).toHaveBeenCalledWith(
        'https://search.maven.org/solrsearch/select',
        {
          query: {
            q: 'g:"org.springframework" AND a:"spring-core"',
            rows: 1,
            wt: 'json'
          },
          timeout: 10000
        }
      );
    });

    it('should use custom timeout', async () => {
      const customResolver = new MavenResolver(5000);
      const mockResponse: MavenApiResponse = {
        response: {
          numFound: 1,
          start: 0,
          docs: [{
            id: 'org.test:artifact:1.0.0',
            g: 'org.test',
            a: 'artifact',
            latestVersion: '1.0.0',
            repositoryId: 'central',
            p: 'jar',
            timestamp: 1699267845000,
            versionCount: 1,
            text: ['org.test', 'artifact'],
            ec: ['.jar', '.pom']
          }]
        }
      };

      mockedHttpClient.get.mockResolvedValueOnce(createMockHttpResponse(mockResponse));

      await customResolver.getLatestVersion({
        groupId: 'org.test',
        artifactId: 'artifact'
      });

      expect(mockedHttpClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          timeout: 5000
        })
      );
    });
  });

  describe('Response Format', () => {
    it('should return complete version information', async () => {
      const mockResponse: MavenApiResponse = {
        response: {
          numFound: 1,
          start: 0,
          docs: [{
            id: 'org.springframework:spring-core:6.0.0',
            g: 'org.springframework',
            a: 'spring-core',
            latestVersion: '6.0.0',
            repositoryId: 'central',
            p: 'jar',
            timestamp: 1699267845000,
            versionCount: 100,
            text: ['org.springframework', 'spring-core'],
            ec: ['.jar', '.pom']
          }]
        }
      };

      mockedHttpClient.get.mockResolvedValueOnce(createMockHttpResponse(mockResponse));

      const result = await resolver.getLatestVersion({
        groupId: 'org.springframework',
        artifactId: 'spring-core'
      });

      expect(result).toEqual({
        latestVersion: '6.0.0',
        lastUpdated: '2023-11-06T10:50:45.000Z',
        repository: 'Maven Central',
        cached: false
      });
    });

    it('should include excluded versions when filtering occurs', async () => {
      mockedHttpClient.get.mockReset();
      
      const mockMainResponse: MavenApiResponse = {
        response: {
          numFound: 1,
          start: 0,
          docs: [{
            id: 'org.test:artifact:2.0.0-RC1',
            g: 'org.test',
            a: 'artifact',
            latestVersion: '2.0.0-RC1',
            repositoryId: 'central',
            p: 'jar',
            timestamp: 1699267845000,
            versionCount: 4,
            text: ['org.test', 'artifact'],
            ec: ['.jar', '.pom']
          }]
        }
      };

      const mockVersionsResponse = {
        response: {
          numFound: 4,
          start: 0,
          docs: [
            { v: '2.0.0-RC1' },
            { v: '1.9.0' },
            { v: '1.8.0-beta1' },
            { v: '1.7.0' }
          ]
        }
      };

      mockedHttpClient.get
        .mockResolvedValueOnce(createMockHttpResponse(mockMainResponse))
        .mockResolvedValueOnce(createMockHttpResponse(mockVersionsResponse));

      const result = await resolver.getLatestVersion({
        groupId: 'org.test',
        artifactId: 'artifact'
      });

      expect(result.excludedVersions).toBeDefined();
      expect(result.excludedVersions).toContain('2.0.0-RC1');
      expect(result.excludedVersions).toContain('1.8.0-beta1');
      expect(result.totalVersions).toBe(4);
    });
  });
}); 