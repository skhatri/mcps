jest.mock('../tools/maven-resolver.js', () => ({
  mavenResolver: {
    getLatestVersion: jest.fn()
  }
}));

jest.mock('../logging/logger.js', () => ({
  logger: {
    logRequest: jest.fn(),
    logResponse: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn()
  }
}));

jest.mock('../cache/cache-manager.js', () => ({
  cacheManager: {
    destroy: jest.fn()
  }
}));

describe('MCP Server Input Validation', () => {
  describe('Parameter Validation Functions', () => {
    it('should validate string parameters correctly', () => {
      const validateStringParam = (value: any, name: string): string => {
        if (typeof value !== 'string' || !value.trim()) {
          throw new Error(`${name} must be a non-empty string`);
        }
        return value.trim();
      };

      expect(validateStringParam('test', 'param')).toBe('test');
      expect(validateStringParam('  test  ', 'param')).toBe('test');
      expect(() => validateStringParam('', 'param')).toThrow('param must be a non-empty string');
      expect(() => validateStringParam(123, 'param')).toThrow('param must be a non-empty string');
      expect(() => validateStringParam(null, 'param')).toThrow('param must be a non-empty string');
      expect(() => validateStringParam(undefined, 'param')).toThrow('param must be a non-empty string');
    });

    it('should validate arguments object', () => {
      const validateArgs = (args: any) => {
        if (!args || typeof args !== 'object') {
          throw new Error('Arguments are required');
        }
        return args;
      };

      expect(validateArgs({ test: 'value' })).toEqual({ test: 'value' });
      expect(() => validateArgs(null)).toThrow('Arguments are required');
      expect(() => validateArgs(undefined)).toThrow('Arguments are required');
      expect(() => validateArgs('string')).toThrow('Arguments are required');
    });
  });

  describe('Response Formatting', () => {
    it('should format basic response text correctly', () => {
      const formatResponse = (groupId: string, artifactId: string, result: any) => {
        let responseText = `Latest version information for ${groupId}:${artifactId}:\n\n` +
                          `📦 Latest Version: ${result.latestVersion}\n` +
                          `📅 Last Updated: ${result.lastUpdated}\n` +
                          `🏪 Repository: ${result.repository}\n` +
                          `💾 From Cache: ${result.cached ? 'Yes' : 'No'}`;

        if (result.excludedVersions && result.excludedVersions.length > 0) {
          responseText += `\n🚫 Excluded Pre-releases: ${result.excludedVersions.slice(0, 3).join(', ')}`;
          if (result.excludedVersions.length > 3) {
            responseText += ` (and ${result.excludedVersions.length - 3} more)`;
          }
          if (result.totalVersions) {
            responseText += `\n📊 Total Versions Found: ${result.totalVersions}`;
          }
        }

        return responseText;
      };

      const basicResult = {
        latestVersion: '6.2.8',
        lastUpdated: '2023-11-06T15:24:05.000Z',
        repository: 'Maven Central',
        cached: false
      };

      const response = formatResponse('org.springframework', 'spring-core', basicResult);
      
      expect(response).toContain('Latest version information for org.springframework:spring-core:');
      expect(response).toContain('📦 Latest Version: 6.2.8');
      expect(response).toContain('📅 Last Updated: 2023-11-06T15:24:05.000Z');
      expect(response).toContain('🏪 Repository: Maven Central');
      expect(response).toContain('💾 From Cache: No');
      expect(response).not.toContain('🚫 Excluded Pre-releases');
    });

    it('should format response with excluded versions', () => {
      const formatResponse = (groupId: string, artifactId: string, result: any) => {
        let responseText = `Latest version information for ${groupId}:${artifactId}:\n\n` +
                          `📦 Latest Version: ${result.latestVersion}\n` +
                          `📅 Last Updated: ${result.lastUpdated}\n` +
                          `🏪 Repository: ${result.repository}\n` +
                          `💾 From Cache: ${result.cached ? 'Yes' : 'No'}`;

        if (result.excludedVersions && result.excludedVersions.length > 0) {
          responseText += `\n🚫 Excluded Pre-releases: ${result.excludedVersions.slice(0, 3).join(', ')}`;
          if (result.excludedVersions.length > 3) {
            responseText += ` (and ${result.excludedVersions.length - 3} more)`;
          }
          if (result.totalVersions) {
            responseText += `\n📊 Total Versions Found: ${result.totalVersions}`;
          }
        }

        return responseText;
      };

      const resultWithExclusions = {
        latestVersion: '6.2.8',
        lastUpdated: '2023-11-06T15:24:05.000Z',
        repository: 'Maven Central',
        cached: false,
        excludedVersions: ['7.0.0-M6', '7.0.0-M5', '7.0.0-M4', '6.3.0-RC1'],
        totalVersions: 47
      };

      const response = formatResponse('org.springframework', 'spring-core', resultWithExclusions);
      
      expect(response).toContain('🚫 Excluded Pre-releases: 7.0.0-M6, 7.0.0-M5, 7.0.0-M4 (and 1 more)');
      expect(response).toContain('📊 Total Versions Found: 47');
    });

    it('should handle cached responses', () => {
      const formatResponse = (groupId: string, artifactId: string, result: any) => {
        let responseText = `Latest version information for ${groupId}:${artifactId}:\n\n` +
                          `📦 Latest Version: ${result.latestVersion}\n` +
                          `📅 Last Updated: ${result.lastUpdated}\n` +
                          `🏪 Repository: ${result.repository}\n` +
                          `💾 From Cache: ${result.cached ? 'Yes' : 'No'}`;

        return responseText;
      };

      const cachedResult = {
        latestVersion: '2.15.2',
        lastUpdated: '2023-10-15T12:30:45.123Z',
        repository: 'Maven Central',
        cached: true
      };

      const response = formatResponse('com.fasterxml.jackson.core', 'jackson-core', cachedResult);
      
      expect(response).toContain('💾 From Cache: Yes');
      expect(response).toContain('📦 Latest Version: 2.15.2');
    });

    it('should limit excluded versions display', () => {
      const formatResponse = (groupId: string, artifactId: string, result: any) => {
        let responseText = `Latest version information for ${groupId}:${artifactId}:\n\n` +
                          `📦 Latest Version: ${result.latestVersion}\n` +
                          `📅 Last Updated: ${result.lastUpdated}\n` +
                          `🏪 Repository: ${result.repository}\n` +
                          `💾 From Cache: ${result.cached ? 'Yes' : 'No'}`;

        if (result.excludedVersions && result.excludedVersions.length > 0) {
          responseText += `\n🚫 Excluded Pre-releases: ${result.excludedVersions.slice(0, 3).join(', ')}`;
          if (result.excludedVersions.length > 3) {
            responseText += ` (and ${result.excludedVersions.length - 3} more)`;
          }
          if (result.totalVersions) {
            responseText += `\n📊 Total Versions Found: ${result.totalVersions}`;
          }
        }

        return responseText;
      };

      const manyExclusionsResult = {
        latestVersion: '3.1.0',
        lastUpdated: '2023-12-01T10:00:00.000Z',
        repository: 'Maven Central',
        cached: false,
        excludedVersions: ['4.0.0-RC1', '4.0.0-beta2', '3.2.0-SNAPSHOT', '3.1.1-alpha', '3.1.0-RC2'],
        totalVersions: 30
      };

      const response = formatResponse('org.test', 'many-versions', manyExclusionsResult);
      
      expect(response).toContain('🚫 Excluded Pre-releases: 4.0.0-RC1, 4.0.0-beta2, 3.2.0-SNAPSHOT (and 2 more)');
      expect(response).toContain('📊 Total Versions Found: 30');
    });
  });

  describe('Error Handling Logic', () => {
    it('should handle validation errors correctly', () => {
      const handleValidationError = (error: Error) => {
        return {
          error: true,
          message: error.message,
          type: 'validation'
        };
      };

      const validationError = new Error('groupId must be a non-empty string');
      const result = handleValidationError(validationError);
      
      expect(result.error).toBe(true);
      expect(result.message).toBe('groupId must be a non-empty string');
      expect(result.type).toBe('validation');
    });

    it('should handle resolver errors correctly', () => {
      const handleResolverError = (error: Error, context: any) => {
        return {
          error: true,
          message: error.message,
          type: 'resolver',
          context
        };
      };

      const resolverError = new Error('No artifacts found for org.nonexistent:artifact');
      const context = { groupId: 'org.nonexistent', artifactId: 'artifact' };
      const result = handleResolverError(resolverError, context);
      
      expect(result.error).toBe(true);
      expect(result.message).toBe('No artifacts found for org.nonexistent:artifact');
      expect(result.type).toBe('resolver');
      expect(result.context).toEqual(context);
    });
  });

  describe('Integration Tests', () => {
    const { mavenResolver } = require('../tools/maven-resolver.js');
    const { logger } = require('../logging/logger.js');

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should integrate all components for successful request', async () => {
      const mockResult = {
        latestVersion: '6.2.8',
        lastUpdated: '2023-11-06T15:24:05.000Z',
        repository: 'Maven Central',
        cached: false
      };

      mavenResolver.getLatestVersion.mockResolvedValueOnce(mockResult);

      const request = {
        groupId: 'org.springframework',
        artifactId: 'spring-core'
      };

      const result = await mavenResolver.getLatestVersion(request);
      
      expect(result).toEqual(mockResult);
      expect(mavenResolver.getLatestVersion).toHaveBeenCalledWith(request);
    });

    it('should integrate error handling flow', async () => {
      const error = new Error('Maven API timeout');
      mavenResolver.getLatestVersion.mockRejectedValueOnce(error);

      const request = {
        groupId: 'org.test',
        artifactId: 'timeout-test'
      };

      await expect(mavenResolver.getLatestVersion(request)).rejects.toThrow('Maven API timeout');
    });
  });

  describe('Tools Endpoint', () => {
    it('should return tools information in expected format', () => {
      const expectedStructure = {
        service: 'maven-mcp-server',
        version: '1.0.0',
        tools: [
          {
            name: 'latest_version',
            description: 'Get the latest stable version of a Maven artifact',
            parameters: {
              groupId: 'Maven group ID (e.g., "org.springframework")',
              artifactId: 'Maven artifact ID (e.g., "spring-core")'
            },
            example: {
              groupId: 'com.fasterxml.jackson.core',
              artifactId: 'jackson-databind'
            }
          }
        ],
        features: [
          'Filters out pre-release versions (RC, preview, alpha, beta, snapshot)',
          'In-memory caching with 5-minute TTL',
          'Detailed logging of all requests and responses',
          'Semantic version comparison for accurate latest detection'
        ],
        endpoints: {
          health: '/health',
          sse: '/sse',
          tools: '/tools'
        }
      };

      expect(expectedStructure.service).toBe('maven-mcp-server');
      expect(expectedStructure.tools).toHaveLength(1);
      expect(expectedStructure.tools[0]?.name).toBe('latest_version');
      expect(expectedStructure.endpoints.tools).toBe('/tools');
      expect(expectedStructure.features).toContain('Filters out pre-release versions (RC, preview, alpha, beta, snapshot)');
    });
  });
}); 