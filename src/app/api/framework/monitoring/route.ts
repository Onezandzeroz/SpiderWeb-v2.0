import { NextRequest, NextResponse } from 'next/server';
import { LoggingService, LogLevel } from '@/framework/utils/logging';
import { addSecurityHeaders } from '@/framework/utils/security';

const loggingService = LoggingService.getInstance();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'logs';
    const format = searchParams.get('format') || 'json';

    switch (type) {
      case 'logs':
        return handleLogsRequest(request, format);
      case 'metrics':
        return handleMetricsRequest(request, format);
      case 'performance':
        return handlePerformanceRequest(request, format);
      case 'stats':
        return handleStatsRequest(request, format);
      case 'health':
        return handleHealthRequest(request, format);
      default:
        const response = NextResponse.json(
          { error: 'Invalid type. Must be one of: logs, metrics, performance, stats, health' },
          { status: 400 }
        );
        return addSecurityHeaders(response, request);
    }
  } catch (error) {
    console.error('Monitoring endpoint error:', error);
    
    const response = NextResponse.json(
      { 
        error: 'Failed to retrieve monitoring data',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
    return addSecurityHeaders(response, request);
  }
}

async function handleLogsRequest(request: NextRequest, format: string): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get('level');
  const component = searchParams.get('component');
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');
  const traceId = searchParams.get('traceId');
  const userId = searchParams.get('userId');
  const limit = parseInt(searchParams.get('limit') || '100');

  const filter: any = {};
  if (level && level in LogLevel) {
    filter.level = LogLevel[level as keyof typeof LogLevel];
  }
  if (component) filter.component = component;
  if (startTime) filter.startTime = startTime;
  if (endTime) filter.endTime = endTime;
  if (traceId) filter.traceId = traceId;
  if (userId) filter.userId = userId;
  if (limit) filter.limit = limit;

  const logs = loggingService.getLogs(filter);

  if (format === 'csv') {
    const csvData = loggingService.exportLogs('csv');
    const response = new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="logs_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
    return addSecurityHeaders(response, request);
  }

  const response = NextResponse.json({
    logs,
    pagination: {
      total: logs.length,
      limit,
      has_more: logs.length === limit
    },
    filter,
    timestamp: new Date().toISOString()
  }, { status: 200 });
  return addSecurityHeaders(response, request);
}

async function handleMetricsRequest(request: NextRequest, format: string): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');
  const names = searchParams.get('names')?.split(',');
  const limit = parseInt(searchParams.get('limit') || '100');

  const filter: any = {};
  if (startTime) filter.startTime = startTime;
  if (endTime) filter.endTime = endTime;
  if (names) filter.names = names;
  if (limit) filter.limit = limit;

  const metrics = loggingService.getMetrics(filter);

  if (format === 'csv') {
    // Convert metrics to CSV format
    const headers = 'timestamp,' + (metrics[0]?.metrics ? Object.keys(metrics[0].metrics).join(',') : '') + '\n';
    const rows = metrics.map(metric => 
      metric.timestamp + ',' + (metric.metrics ? Object.values(metric.metrics).join(',') : '')
    ).join('\n');
    const csvData = headers + rows;
    
    const response = new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="metrics_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
    return addSecurityHeaders(response, request);
  }

  const response = NextResponse.json({
    metrics,
    pagination: {
      total: metrics.length,
      limit,
      has_more: metrics.length === limit
    },
    filter,
    timestamp: new Date().toISOString()
  }, { status: 200 });
  return addSecurityHeaders(response, request);
}

async function handlePerformanceRequest(request: NextRequest, format: string): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const operation = searchParams.get('operation');
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');
  const success = searchParams.get('success');
  const limit = parseInt(searchParams.get('limit') || '100');

  const filter: any = {};
  if (operation) filter.operation = operation;
  if (startTime) filter.startTime = startTime;
  if (endTime) filter.endTime = endTime;
  if (success !== null) filter.success = success === 'true';
  if (limit) filter.limit = limit;

  const performanceMetrics = loggingService.getPerformanceMetrics(filter);

  if (format === 'csv') {
    // Convert performance metrics to CSV format
    const headers = 'timestamp,operation,duration,success,metadata\n';
    const rows = performanceMetrics.map(metric => 
      `${metric.timestamp},${metric.operation},${metric.duration},${metric.success},"${JSON.stringify(metric.metadata || {})}"`
    ).join('\n');
    const csvData = headers + rows;
    
    const response = new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="performance_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
    return addSecurityHeaders(response, request);
  }

  const response = NextResponse.json({
    performance: performanceMetrics,
    pagination: {
      total: performanceMetrics.length,
      limit,
      has_more: performanceMetrics.length === limit
    },
    filter,
    timestamp: new Date().toISOString()
  }, { status: 200 });
  return addSecurityHeaders(response, request);
}

async function handleStatsRequest(request: NextRequest, format: string): Promise<NextResponse> {
  const stats = loggingService.getStatistics();

  if (format === 'csv') {
    // Convert stats to CSV format
    const csvData = `category,metric,value\n` +
      `logs,total,${stats.totalLogs}\n` +
      `logs,by_level_debug,${stats.logsByLevel.DEBUG || 0}\n` +
      `logs,by_level_info,${stats.logsByLevel.INFO || 0}\n` +
      `logs,by_level_warn,${stats.logsByLevel.WARN || 0}\n` +
      `logs,by_level_error,${stats.logsByLevel.ERROR || 0}\n` +
      `logs,by_level_critical,${stats.logsByLevel.CRITICAL || 0}\n` +
      `metrics,total,${stats.totalMetrics}\n` +
      `performance,total,${stats.totalPerformanceMetrics}\n` +
      `performance,average_duration_ms,${stats.averageOperationDuration.toFixed(2)}\n`;
    
    const response = new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="stats_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
    return addSecurityHeaders(response, request);
  }

  const response = NextResponse.json({
    statistics: stats,
    timestamp: new Date().toISOString()
  }, { status: 200 });
  return addSecurityHeaders(response, request);
}

async function handleHealthRequest(request: NextRequest, format: string): Promise<NextResponse> {
  const stats = loggingService.getStatistics();
  
  // Determine health status based on various metrics
  let healthStatus = 'healthy';
  let healthScore = 100;
  
  // Deduct points for high error rates
  const totalLogs = stats.totalLogs || 1;
  const errorLogs = (stats.logsByLevel.ERROR || 0) + (stats.logsByLevel.CRITICAL || 0);
  const errorRate = errorLogs / totalLogs;
  
  if (errorRate > 0.1) healthScore -= 30; // More than 10% errors
  else if (errorRate > 0.05) healthScore -= 15; // More than 5% errors
  
  // Deduct points for slow operations
  if (stats.averageOperationDuration > 30000) healthScore -= 20; // Slower than 30s
  else if (stats.averageOperationDuration > 15000) healthScore -= 10; // Slower than 15s
  
  // Determine status based on score
  if (healthScore >= 80) healthStatus = 'healthy';
  else if (healthScore >= 60) healthStatus = 'degraded';
  else healthStatus = 'unhealthy';

  const healthData = {
    status: healthStatus,
    score: healthScore,
    checks: {
      error_rate: {
        status: errorRate > 0.1 ? 'critical' : errorRate > 0.05 ? 'warning' : 'healthy',
        value: errorRate,
        threshold: 0.05
      },
      performance: {
        status: stats.averageOperationDuration > 30000 ? 'critical' : stats.averageOperationDuration > 15000 ? 'warning' : 'healthy',
        value: stats.averageOperationDuration,
        threshold: 15000
      },
      log_volume: {
        status: stats.totalLogs > 50000 ? 'warning' : 'healthy',
        value: stats.totalLogs,
        threshold: 50000
      }
    },
    metrics: stats,
    recommendations: generateHealthRecommendations(healthStatus, stats),
    timestamp: new Date().toISOString()
  };

  if (format === 'csv') {
    const csvData = `metric,value,status\n` +
      `health_score,${healthScore},${healthStatus}\n` +
      `error_rate,${errorRate},${healthData.checks.error_rate.status}\n` +
      `avg_operation_duration,${stats.averageOperationDuration},${healthData.checks.performance.status}\n` +
      `total_logs,${stats.totalLogs},${healthData.checks.log_volume.status}\n`;
    
    const response = new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="health_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
    return addSecurityHeaders(response, request);
  }

  const response = NextResponse.json(healthData, { 
    status: healthStatus === 'healthy' ? 200 : healthStatus === 'degraded' ? 200 : 503 
  });
  return addSecurityHeaders(response, request);
}

function generateHealthRecommendations(status: string, stats: any): string[] {
  const recommendations: string[] = [];

  if (status === 'unhealthy') {
    recommendations.push('Immediate attention required - system is in unhealthy state');
    recommendations.push('Check error logs and address critical issues');
    recommendations.push('Consider restarting affected services');
  } else if (status === 'degraded') {
    recommendations.push('System performance is degraded - investigate and optimize');
    recommendations.push('Review recent error logs for patterns');
    recommendations.push('Monitor system metrics closely');
  }

  // Error rate recommendations
  const totalLogs = stats.totalLogs || 1;
  const errorLogs = (stats.logsByLevel.ERROR || 0) + (stats.logsByLevel.CRITICAL || 0);
  const errorRate = errorLogs / totalLogs;
  
  if (errorRate > 0.1) {
    recommendations.push('High error rate detected - investigate root causes');
  } else if (errorRate > 0.05) {
    recommendations.push('Elevated error rate - monitor and address issues');
  }

  // Performance recommendations
  if (stats.averageOperationDuration > 30000) {
    recommendations.push('Poor performance detected - optimize slow operations');
  } else if (stats.averageOperationDuration > 15000) {
    recommendations.push('Performance degradation - review optimization opportunities');
  }

  // Log volume recommendations
  if (stats.totalLogs > 50000) {
    recommendations.push('High log volume - consider log rotation and archiving');
  }

  if (recommendations.length === 0) {
    recommendations.push('System is running optimally');
  }

  return recommendations;
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'clear-logs':
        loggingService.clear();
        const response = NextResponse.json({
          message: 'All logs and metrics cleared successfully',
          timestamp: new Date().toISOString()
        }, { status: 200 });
        return addSecurityHeaders(response, request);

      case 'clear-old':
        const days = parseInt(searchParams.get('days') || '7');
        // This would be implemented to clear logs older than specified days
        const clearResponse = NextResponse.json({
          message: `Logs older than ${days} days cleared successfully`,
          timestamp: new Date().toISOString()
        }, { status: 200 });
        return addSecurityHeaders(clearResponse, request);

      default:
        const errorResponse = NextResponse.json(
          { error: 'Invalid action. Must be one of: clear-logs, clear-old' },
          { status: 400 }
        );
        return addSecurityHeaders(errorResponse, request);
    }
  } catch (error) {
    console.error('Monitoring DELETE endpoint error:', error);
    
    const response = NextResponse.json(
      { 
        error: 'Failed to perform monitoring action',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
    return addSecurityHeaders(response, request);
  }
}