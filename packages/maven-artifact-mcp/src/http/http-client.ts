import { request, ProxyAgent, Agent } from 'undici';
import { logger } from '../logging/logger.js';

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string | Buffer;
  timeout?: number;
  query?: Record<string, string | number>;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export class HttpClient {
  private dispatcher: Agent | ProxyAgent;
  private baseHeaders: Record<string, string>;

  constructor() {
    this.baseHeaders = {
      'User-Agent': 'maven-version-mcp-server/1.0.0',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate'
    };

    this.dispatcher = this.createDispatcher();
  }

  private createDispatcher(): Agent | ProxyAgent {
    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const noProxy = process.env.NO_PROXY || process.env.no_proxy;

    if (httpProxy || httpsProxy) {
      const proxyUrl = httpsProxy || httpProxy;
      logger.logInfo(`Using proxy: ${proxyUrl}`);
      
      const proxyOptions: any = {
        uri: proxyUrl,
        keepAliveTimeout: 30000,
        keepAliveMaxTimeout: 60000,
        keepAliveTimeoutThreshold: 2000
      };

      if (noProxy) {
        proxyOptions.requestTls = {
          rejectUnauthorized: false
        };
      }

      return new ProxyAgent(proxyOptions);
    }

    return new Agent({
      keepAliveTimeout: 30000,
      keepAliveMaxTimeout: 60000,
      keepAliveTimeoutThreshold: 2000,
      connections: 10
    });
  }

  private buildUrl(baseUrl: string, query?: Record<string, string | number>): string {
    if (!query || Object.keys(query).length === 0) {
      return baseUrl;
    }

    const url = new URL(baseUrl);
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
    
    return url.toString();
  }

  private shouldUseProxy(url: string): boolean {
    const noProxy = process.env.NO_PROXY || process.env.no_proxy;
    if (!noProxy) return true;

    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    
    const noProxyList = noProxy.split(',').map(s => s.trim().toLowerCase());
    
    return !noProxyList.some(pattern => {
      if (pattern === '*') return true;
      if (pattern.startsWith('.')) {
        return hostname.endsWith(pattern) || hostname === pattern.slice(1);
      }
      return hostname === pattern || hostname.endsWith('.' + pattern);
    });
  }

  async get<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST' });
  }

  async request<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = 10000,
      query
    } = options;

    const fullUrl = this.buildUrl(url, query);
    const useProxy = this.shouldUseProxy(fullUrl);
    
    let dispatcher = this.dispatcher;
    if (!useProxy && this.dispatcher instanceof ProxyAgent) {
      dispatcher = new Agent({
        keepAliveTimeout: 30000,
        keepAliveMaxTimeout: 60000,
        keepAliveTimeoutThreshold: 2000
      });
    }

    const requestHeaders = {
      ...this.baseHeaders,
      ...headers
    };

    const startTime = Date.now();
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount <= maxRetries) {
      try {
        logger.logInfo(`HTTP ${method} ${fullUrl} (attempt ${retryCount + 1})`);

        const requestOptions: any = {
          method,
          headers: requestHeaders,
          dispatcher,
          maxRedirections: 5,
          throwOnError: true,
          bodyTimeout: timeout,
          headersTimeout: timeout / 2
        };

        if (body !== undefined) {
          requestOptions.body = body;
        }

        const response = await request(fullUrl, requestOptions);

        const responseHeaders: Record<string, string> = {};
        Object.entries(response.headers).forEach(([key, value]) => {
          responseHeaders[key] = Array.isArray(value) ? value.join(', ') : String(value);
        });

        let data: T;
        const contentType = responseHeaders['content-type'] || '';
        
        if (contentType.includes('application/json')) {
          const text = await response.body.text();
          data = JSON.parse(text) as T;
        } else {
          data = await response.body.text() as unknown as T;
        }

        const duration = Date.now() - startTime;
        logger.logInfo(`HTTP ${method} ${fullUrl} completed in ${duration}ms (status: ${response.statusCode})`);

        return {
          data,
          status: response.statusCode,
          headers: responseHeaders
        };

      } catch (error) {
        retryCount++;
        const duration = Date.now() - startTime;
        
        if (retryCount > maxRetries) {
          logger.logError(`HTTP ${method}`, `Request failed after ${maxRetries + 1} attempts in ${duration}ms: ${error}`);
          throw this.createHttpError(error, url, method);
        }

        const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
        logger.logWarning(`HTTP ${method} ${fullUrl} failed (attempt ${retryCount}), retrying in ${delay}ms: ${error}`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Unexpected end of retry loop');
  }

  private createHttpError(error: any, url: string, method: string): Error {
    if (error.code === 'UND_ERR_CONNECT_TIMEOUT') {
      return new Error(`Connection timeout for ${method} ${url}`);
    }
    
    if (error.code === 'UND_ERR_HEADERS_TIMEOUT') {
      return new Error(`Headers timeout for ${method} ${url}`);
    }
    
    if (error.code === 'UND_ERR_BODY_TIMEOUT') {
      return new Error(`Body timeout for ${method} ${url}`);
    }
    
    if (error.code === 'ENOTFOUND') {
      return new Error(`DNS resolution failed for ${url}`);
    }
    
    if (error.code === 'ECONNREFUSED') {
      return new Error(`Connection refused for ${url}`);
    }
    
    if (error.code === 'ECONNRESET') {
      return new Error(`Connection reset for ${url}`);
    }

    if (error.statusCode) {
      return new Error(`HTTP ${error.statusCode} for ${method} ${url}: ${error.message || 'Unknown error'}`);
    }

    return new Error(`HTTP request failed for ${method} ${url}: ${error.message || String(error)}`);
  }

  destroy(): void {
    if (this.dispatcher) {
      this.dispatcher.destroy();
    }
  }
}

export const httpClient = new HttpClient();