import { Logger } from '../logger.js';

describe('Logger', () => {
  let logger: Logger;
  let consoleSpy: {
    log: jest.SpyInstance;
    error: jest.SpyInstance;
    warn: jest.SpyInstance;
  };

  beforeEach(() => {
    logger = new Logger();
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {})
    };
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
    consoleSpy.warn.mockRestore();
  });

  describe('Request Logging', () => {
    it('should log request with proper format', () => {
      const tool = 'latest_version';
      const params = { groupId: 'org.springframework', artifactId: 'spring-core' };

      logger.logRequest(tool, params);

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.log.mock.calls[0][0];
      
      expect(logCall).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] REQUEST: latest_version\(groupId="org\.springframework", artifactId="spring-core"\)$/);
    });

    it('should handle multiple parameters in request logging', () => {
      const tool = 'test_tool';
      const params = { 
        param1: 'value1', 
        param2: 'value2', 
        param3: 'value with spaces' 
      };

      logger.logRequest(tool, params);

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.log.mock.calls[0][0];
      
      expect(logCall).toContain('param1="value1"');
      expect(logCall).toContain('param2="value2"');
      expect(logCall).toContain('param3="value with spaces"');
    });

    it('should handle empty parameters object', () => {
      const tool = 'empty_tool';
      const params = {};

      logger.logRequest(tool, params);

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.log.mock.calls[0][0];
      
      expect(logCall).toMatch(/REQUEST: empty_tool\(\)$/);
    });

    it('should handle parameters with special characters', () => {
      const tool = 'special_tool';
      const params = { 
        'param-with-dash': 'value',
        'param.with.dots': 'another-value',
        'param_underscore': 'third_value'
      };

      logger.logRequest(tool, params);

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.log.mock.calls[0][0];
      
      expect(logCall).toContain('param-with-dash="value"');
      expect(logCall).toContain('param.with.dots="another-value"');
      expect(logCall).toContain('param_underscore="third_value"');
    });
  });

  describe('Response Logging', () => {
    it('should log response with proper format', () => {
      const tool = 'latest_version';
      const response = {
        latestVersion: '6.2.8',
        cached: false,
        repository: 'Maven Central'
      };

      logger.logResponse(tool, response);

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.log.mock.calls[0][0];
      
      expect(logCall).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] RESPONSE: latest_version -> /);
      expect(logCall).toContain(JSON.stringify(response));
    });

    it('should handle complex response objects', () => {
      const tool = 'complex_tool';
      const response = {
        data: {
          nested: {
            value: 'test'
          }
        },
        array: [1, 2, 3],
        boolean: true,
        nullValue: null
      };

      logger.logResponse(tool, response);

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.log.mock.calls[0][0];
      
      expect(logCall).toContain(JSON.stringify(response));
      expect(logCall).toContain('"nested":{"value":"test"}');
      expect(logCall).toContain('"array":[1,2,3]');
    });

    it('should handle string responses', () => {
      const tool = 'string_tool';
      const response = 'simple string response';

      logger.logResponse(tool, response);

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.log.mock.calls[0][0];
      
      expect(logCall).toContain('"simple string response"');
    });

    it('should handle undefined and null responses', () => {
      const tool = 'null_tool';

      logger.logResponse(tool, null);
      logger.logResponse(tool, undefined);

      expect(consoleSpy.log).toHaveBeenCalledTimes(2);
      
      const firstCall = consoleSpy.log.mock.calls[0][0];
      const secondCall = consoleSpy.log.mock.calls[1][0];
      
      expect(firstCall).toContain('null');
      expect(secondCall).toContain('undefined');
    });
  });

  describe('Error Logging', () => {
    it('should log error with proper format', () => {
      const tool = 'error_tool';
      const error = 'Something went wrong';

      logger.logError(tool, error);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.error.mock.calls[0][0];
      
      expect(logCall).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] ERROR: error_tool -> Something went wrong$/);
    });

    it('should log error with details', () => {
      const tool = 'detailed_error_tool';
      const error = 'API timeout';
      const details = {
        timeout: 10000,
        url: 'https://api.example.com',
        retries: 3
      };

      logger.logError(tool, error, details);

      expect(consoleSpy.error).toHaveBeenCalledTimes(2);
      
      const errorCall = consoleSpy.error.mock.calls[0][0];
      const detailsCall = consoleSpy.error.mock.calls[1];
      
      expect(errorCall).toContain('ERROR: detailed_error_tool -> API timeout');
      expect(detailsCall[0]).toBe('Error details:');
      expect(detailsCall[1]).toEqual(details);
    });

    it('should handle error without details', () => {
      const tool = 'simple_error_tool';
      const error = 'Network failure';

      logger.logError(tool, error);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      
      const logCall = consoleSpy.error.mock.calls[0][0];
      expect(logCall).toContain('ERROR: simple_error_tool -> Network failure');
    });

    it('should handle empty error messages', () => {
      const tool = 'empty_error_tool';
      const error = '';

      logger.logError(tool, error);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      
      const logCall = consoleSpy.error.mock.calls[0][0];
      expect(logCall).toContain('ERROR: empty_error_tool ->');
    });
  });

  describe('Info and Warning Logging', () => {
    it('should log info messages with proper format', () => {
      const message = 'Cache hit for org.springframework:spring-core';

      logger.logInfo(message);

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.log.mock.calls[0][0];
      
      expect(logCall).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] INFO: Cache hit for org\.springframework:spring-core$/);
    });

    it('should log warning messages with proper format', () => {
      const message = 'API rate limit approaching';

      logger.logWarning(message);

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.warn.mock.calls[0][0];
      
      expect(logCall).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] WARNING: API rate limit approaching$/);
    });

    it('should handle empty info and warning messages', () => {
      logger.logInfo('');
      logger.logWarning('');

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      
      const infoCall = consoleSpy.log.mock.calls[0][0];
      const warnCall = consoleSpy.warn.mock.calls[0][0];
      
      expect(infoCall).toMatch(/INFO: $/);
      expect(warnCall).toMatch(/WARNING: $/);
    });

    it('should handle multiline messages', () => {
      const multilineMessage = 'Line 1\nLine 2\nLine 3';

      logger.logInfo(multilineMessage);

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.log.mock.calls[0][0];
      
      expect(logCall).toContain('Line 1\nLine 2\nLine 3');
    });
  });

  describe('Timestamp Formatting', () => {
    it('should use ISO 8601 timestamp format', () => {
      logger.logInfo('test message');

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.log.mock.calls[0][0];
      
      const timestampMatch = logCall.match(/^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/);
      expect(timestampMatch).toBeTruthy();
      
      if (timestampMatch) {
        const timestamp = timestampMatch[1];
        expect(() => new Date(timestamp)).not.toThrow();
        
        const date = new Date(timestamp);
        expect(date.toISOString()).toBe(timestamp);
      }
    });

    it('should generate recent timestamps', () => {
      const beforeTime = Date.now();
      logger.logInfo('timestamp test');
      const afterTime = Date.now();

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.log.mock.calls[0][0];
      
      const timestampMatch = logCall.match(/^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/);
      expect(timestampMatch).toBeTruthy();
      
      if (timestampMatch) {
        const loggedTime = new Date(timestampMatch[1]).getTime();
        expect(loggedTime).toBeGreaterThanOrEqual(beforeTime);
        expect(loggedTime).toBeLessThanOrEqual(afterTime);
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle circular reference objects in responses', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      expect(() => {
        logger.logResponse('circular_tool', circularObj);
      }).not.toThrow();

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.log.mock.calls[0][0];
      expect(logCall).toContain('[Circular Reference Object]');
    });

    it('should handle very large parameter objects', () => {
      const largeParams: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        largeParams[`param${i}`] = `value${i}`.repeat(10);
      }

      expect(() => {
        logger.logRequest('large_tool', largeParams);
      }).not.toThrow();

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
    });

    it('should handle special parameter values', () => {
      const specialParams = {
        nullParam: null,
        undefinedParam: undefined,
        numberParam: 42,
        booleanParam: true,
        arrayParam: [1, 2, 3],
        objectParam: { nested: 'value' }
      };

      expect(() => {
        logger.logRequest('special_tool', specialParams);
      }).not.toThrow();

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      const logCall = consoleSpy.log.mock.calls[0][0];
      
      expect(logCall).toContain('nullParam="null"');
      expect(logCall).toContain('undefinedParam="undefined"');
      expect(logCall).toContain('numberParam="42"');
      expect(logCall).toContain('booleanParam="true"');
    });
  });
}); 