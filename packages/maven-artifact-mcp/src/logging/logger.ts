import { LogEntry } from '../types/maven.js';

export class Logger {
  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private createLogEntry(
    type: LogEntry['type'],
    tool: string,
    message: string,
    data?: any
  ): LogEntry {
    return {
      timestamp: this.formatTimestamp(),
      type,
      tool,
      message,
      data
    };
  }

  logRequest(tool: string, params: Record<string, any>): void {
    const paramString = Object.entries(params)
      .map(([key, value]) => `${key}="${value}"`)
      .join(', ');
    
    const message = `${tool}(${paramString})`;
    const logEntry = this.createLogEntry('REQUEST', tool, message, params);
    
    console.log(`[${logEntry.timestamp}] REQUEST: ${message}`);
  }

  logResponse(tool: string, response: any): void {
    let responseString: string;
    try {
      responseString = JSON.stringify(response);
    } catch (error) {
      responseString = '[Circular Reference Object]';
    }
    const logEntry = this.createLogEntry('RESPONSE', tool, responseString, response);
    
    console.log(`[${logEntry.timestamp}] RESPONSE: ${tool} -> ${responseString}`);
  }

  logError(tool: string, error: string, details?: any): void {
    const logEntry = this.createLogEntry('ERROR', tool, error, details);
    
    console.error(`[${logEntry.timestamp}] ERROR: ${tool} -> ${error}`);
    
    if (details) {
      console.error('Error details:', details);
    }
  }

  logInfo(message: string): void {
    console.log(`[${this.formatTimestamp()}] INFO: ${message}`);
  }

  logWarning(message: string): void {
    console.warn(`[${this.formatTimestamp()}] WARNING: ${message}`);
  }
}

export const logger = new Logger(); 