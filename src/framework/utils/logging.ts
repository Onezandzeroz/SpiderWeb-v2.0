export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  component: string;
  metadata?: Record<string, any>;
  traceId?: string;
  userId?: string;
}

export interface MetricsData {
  timestamp: string;
  metrics: Record<string, number>;
  tags?: Record<string, string>;
}

export interface PerformanceMetrics {
  timestamp: string;
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export class LoggingService {
  private static instance: LoggingService;
  private logs: LogEntry[] = [];
  private metrics: MetricsData[] = [];
  private performanceMetrics: PerformanceMetrics[] = [];
  private logLevel: LogLevel = LogLevel.INFO;
  private maxLogEntries: number = 10000;
  private maxMetricsEntries: number = 5000;

  private constructor() {
    // Initialize with default log level
    this.setLogLevelFromEnvironment();
    
    // Start periodic cleanup
    this.startPeriodicCleanup();
    
    // Log service startup
    this.info('LoggingService', 'Logging service initialized');
  }

  static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  // Log level methods
  debug(component: string, message: string, metadata?: Record<string, any>, traceId?: string, userId?: string): void {
    this.log(LogLevel.DEBUG, component, message, metadata, traceId, userId);
  }

  info(component: string, message: string, metadata?: Record<string, any>, traceId?: string, userId?: string): void {
    this.log(LogLevel.INFO, component, message, metadata, traceId, userId);
  }

  warn(component: string, message: string, metadata?: Record<string, any>, traceId?: string, userId?: string): void {
    this.log(LogLevel.WARN, component, message, metadata, traceId, userId);
  }

  error(component: string, message: string, metadata?: Record<string, any>, traceId?: string, userId?: string): void {
    this.log(LogLevel.ERROR, component, message, metadata, traceId, userId);
  }

  critical(component: string, message: string, metadata?: Record<string, any>, traceId?: string, userId?: string): void {
    this.log(LogLevel.CRITICAL, component, message, metadata, traceId, userId);
  }

  private log(level: LogLevel, component: string, message: string, metadata?: Record<string, any>, traceId?: string, userId?: string): void {
    if (level < this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component,
      metadata,
      traceId,
      userId
    };

    this.logs.push(entry);

    // Maintain log size limit
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }

    // Output to console for development
    if (process.env.NODE_ENV === 'development') {
      this.logToConsole(entry);
    }

    // Send to external monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToExternalService(entry);
    }
  }

  private logToConsole(entry: LogEntry): void {
    const levelName = LogLevel[entry.level];
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${levelName}] [${entry.component}]`;
    
    const message = entry.metadata 
      ? `${prefix} ${entry.message} ${JSON.stringify(entry.metadata)}`
      : `${prefix} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(message);
        break;
      case LogLevel.INFO:
        console.info(message);
        break;
      case LogLevel.WARN:
        console.warn(message);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(message);
        break;
    }
  }

  private sendToExternalService(entry: LogEntry): void {
    // In a real implementation, this would send to services like:
    // - Datadog
    // - New Relic
    // - ELK Stack
    // - CloudWatch
    // For now, we'll just simulate it
    if (entry.level >= LogLevel.ERROR) {
      // Send critical logs to error tracking service
      this.sendToErrorTracking(entry);
    }
  }

  private sendToErrorTracking(entry: LogEntry): void {
    // Simulate sending to error tracking service
    console.log(`[ERROR_TRACKING] Sending error: ${entry.message} from ${entry.component}`);
  }

  // Metrics collection
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const timestamp = new Date().toISOString();
    
    // Find existing metrics entry for this timestamp (within the same second)
    let metricsEntry = this.metrics.find(m => 
      Math.abs(new Date(m.timestamp).getTime() - new Date(timestamp).getTime()) < 1000
    );

    if (!metricsEntry) {
      metricsEntry = {
        timestamp,
        metrics: {},
        tags: {}
      };
      this.metrics.push(metricsEntry);

      // Maintain metrics size limit
      if (this.metrics.length > this.maxMetricsEntries) {
        this.metrics = this.metrics.slice(-this.maxMetricsEntries);
      }
    }

    metricsEntry.metrics[name] = value;
    if (tags) {
      Object.assign(metricsEntry.tags || {}, tags);
    }
  }

  incrementMetric(name: string, value: number = 1, tags?: Record<string, string>): void {
    const current = this.getMetricValue(name);
    this.recordMetric(name, current + value, tags);
  }

  getMetricValue(name: string): number {
    // Get the most recent value for a metric
    for (let i = this.metrics.length - 1; i >= 0; i--) {
      if (name in this.metrics[i].metrics) {
        return this.metrics[i].metrics[name];
      }
    }
    return 0;
  }

  // Performance monitoring
  startOperation(operation: string, metadata?: Record<string, any>): string {
    const traceId = this.generateTraceId();
    const startTime = Date.now();
    
    // Store the start time temporarily
    (global as any)[`perf_${traceId}`] = {
      operation,
      startTime,
      metadata
    };

    this.debug('PerformanceMonitor', `Started operation: ${operation}`, { traceId, metadata });
    return traceId;
  }

  endOperation(traceId: string, success: boolean = true, additionalMetadata?: Record<string, any>): void {
    const perfData = (global as any)[`perf_${traceId}`];
    if (!perfData) {
      this.warn('PerformanceMonitor', `No performance data found for traceId: ${traceId}`);
      return;
    }

    const duration = Date.now() - perfData.startTime;
    const metadata = { ...perfData.metadata, ...additionalMetadata };

    const perfEntry: PerformanceMetrics = {
      timestamp: new Date().toISOString(),
      operation: perfData.operation,
      duration,
      success,
      metadata
    };

    this.performanceMetrics.push(perfEntry);

    // Maintain performance metrics size limit
    if (this.performanceMetrics.length > this.maxMetricsEntries) {
      this.performanceMetrics = this.performanceMetrics.slice(-this.maxMetricsEntries);
    }

    // Record as metrics
    this.recordMetric(`operation.${perfData.operation}.duration`, duration);
    this.recordMetric(`operation.${perfData.operation}.count`, 1);
    if (success) {
      this.recordMetric(`operation.${perfData.operation}.success`, 1);
    } else {
      this.recordMetric(`operation.${perfData.operation}.failure`, 1);
    }

    // Clean up
    delete (global as any)[`perf_${traceId}`];

    this.debug('PerformanceMonitor', 
      `Ended operation: ${perfData.operation} in ${duration}ms`, 
      { traceId, duration, success, metadata }
    );
  }

  // Audit logging for security events
  logSecurityEvent(event: string, details: Record<string, any>, userId?: string): void {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      userId,
      severity: this.determineSecurityEventSeverity(event)
    };

    this.info('SecurityAudit', `Security event: ${event}`, auditEntry);
    
    // Also send to security monitoring
    this.sendToSecurityMonitoring(auditEntry);
  }

  private determineSecurityEventSeverity(event: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalEvents = ['authentication_failure', 'authorization_breach', 'data_breach'];
    const highEvents = ['suspicious_activity', 'rate_limit_exceeded', 'invalid_input'];
    const mediumEvents = ['api_key_validation', 'cors_violation'];

    if (criticalEvents.includes(event)) return 'critical';
    if (highEvents.includes(event)) return 'high';
    if (mediumEvents.includes(event)) return 'medium';
    return 'low';
  }

  private sendToSecurityMonitoring(auditEntry: any): void {
    // In a real implementation, this would send to security monitoring services
    console.log(`[SECURITY_MONITORING] Security event: ${auditEntry.event}`);
  }

  // Query methods
  getLogs(filter?: {
    level?: LogLevel;
    component?: string;
    startTime?: string;
    endTime?: string;
    traceId?: string;
    userId?: string;
    limit?: number;
  }): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.level !== undefined) {
        filteredLogs = filteredLogs.filter(log => log.level >= filter.level!);
      }
      if (filter.component) {
        filteredLogs = filteredLogs.filter(log => log.component === filter.component);
      }
      if (filter.startTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filter.endTime!);
      }
      if (filter.traceId) {
        filteredLogs = filteredLogs.filter(log => log.traceId === filter.traceId);
      }
      if (filter.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filter.userId);
      }
      if (filter.limit) {
        filteredLogs = filteredLogs.slice(-filter.limit);
      }
    }

    return filteredLogs;
  }

  getMetrics(filter?: {
    startTime?: string;
    endTime?: string;
    names?: string[];
    limit?: number;
  }): MetricsData[] {
    let filteredMetrics = [...this.metrics];

    if (filter) {
      if (filter.startTime) {
        filteredMetrics = filteredMetrics.filter(metric => metric.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        filteredMetrics = filteredMetrics.filter(metric => metric.timestamp <= filter.endTime!);
      }
      if (filter.names) {
        filteredMetrics = filteredMetrics.filter(metric => 
          filter.names!.some(name => name in metric.metrics)
        );
      }
      if (filter.limit) {
        filteredMetrics = filteredMetrics.slice(-filter.limit);
      }
    }

    return filteredMetrics;
  }

  getPerformanceMetrics(filter?: {
    operation?: string;
    startTime?: string;
    endTime?: string;
    success?: boolean;
    limit?: number;
  }): PerformanceMetrics[] {
    let filteredMetrics = [...this.performanceMetrics];

    if (filter) {
      if (filter.operation) {
        filteredMetrics = filteredMetrics.filter(metric => metric.operation === filter.operation);
      }
      if (filter.startTime) {
        filteredMetrics = filteredMetrics.filter(metric => metric.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        filteredMetrics = filteredMetrics.filter(metric => metric.timestamp <= filter.endTime!);
      }
      if (filter.success !== undefined) {
        filteredMetrics = filteredMetrics.filter(metric => metric.success === filter.success);
      }
      if (filter.limit) {
        filteredMetrics = filteredMetrics.slice(-filter.limit);
      }
    }

    return filteredMetrics;
  }

  // Utility methods
  private setLogLevelFromEnvironment(): void {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLevel && envLevel in LogLevel) {
      this.logLevel = LogLevel[envLevel as keyof typeof LogLevel];
    }
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startPeriodicCleanup(): void {
    // Clean up old entries every hour
    setInterval(() => {
      this.cleanupOldEntries();
    }, 60 * 60 * 1000);
  }

  private cleanupOldEntries(): void {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    this.logs = this.logs.filter(log => log.timestamp > oneWeekAgo);
    this.metrics = this.metrics.filter(metric => metric.timestamp > oneWeekAgo);
    this.performanceMetrics = this.performanceMetrics.filter(metric => metric.timestamp > oneWeekAgo);

    this.debug('LoggingService', `Cleaned up entries older than ${oneWeekAgo}`);
  }

  // Statistics and health
  getStatistics(): {
    totalLogs: number;
    totalMetrics: number;
    totalPerformanceMetrics: number;
    logsByLevel: Record<string, number>;
    logsByComponent: Record<string, number>;
    averageOperationDuration: number;
  } {
    const logsByLevel: Record<string, number> = {};
    const logsByComponent: Record<string, number> = {};

    this.logs.forEach(log => {
      const levelName = LogLevel[log.level];
      logsByLevel[levelName] = (logsByLevel[levelName] || 0) + 1;
      logsByComponent[log.component] = (logsByComponent[log.component] || 0) + 1;
    });

    const totalDuration = this.performanceMetrics.reduce((sum, perf) => sum + perf.duration, 0);
    const averageOperationDuration = this.performanceMetrics.length > 0 
      ? totalDuration / this.performanceMetrics.length 
      : 0;

    return {
      totalLogs: this.logs.length,
      totalMetrics: this.metrics.length,
      totalPerformanceMetrics: this.performanceMetrics.length,
      logsByLevel,
      logsByComponent,
      averageOperationDuration
    };
  }

  // Export methods
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    } else {
      // Simple CSV export
      const headers = 'timestamp,level,component,message,metadata,traceId,userId\n';
      const rows = this.logs.map(log => 
        `${log.timestamp},${LogLevel[log.level]},${log.component},"${log.message}","${JSON.stringify(log.metadata || {})}",${log.traceId || ''},${log.userId || ''}`
      ).join('\n');
      return headers + rows;
    }
  }

  clear(): void {
    this.logs = [];
    this.metrics = [];
    this.performanceMetrics = [];
    this.info('LoggingService', 'All logs and metrics cleared');
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info('LoggingService', `Log level set to ${LogLevel[level]}`);
  }
}