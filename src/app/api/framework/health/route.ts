import { NextRequest, NextResponse } from 'next/server';
import { FrameworkController } from '@/framework/controllers/framework-controller';
import { addSecurityHeaders } from '@/framework/utils/security';

const frameworkController = new FrameworkController();

export async function GET(request: NextRequest) {
  try {
    // Get system health status
    const systemHealth = frameworkController.getSystemHealth();
    
    // Additional health checks
    const healthChecks = {
      database: await checkDatabase(),
      memory: checkMemory(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    // Determine overall health status
    let overallStatus = 'healthy';
    if (systemHealth.status === 'unhealthy' || healthChecks.database.status !== 'healthy') {
      overallStatus = 'unhealthy';
    } else if (systemHealth.status === 'degraded') {
      overallStatus = 'degraded';
    }

    const healthResponse = {
      status: overallStatus,
      checks: {
        framework: systemHealth,
        database: healthChecks.database,
        memory: healthChecks.memory
      },
      metrics: {
        uptime: healthChecks.uptime,
        timestamp: healthChecks.timestamp,
        version: '1.0.0'
      },
      recommendations: generateRecommendations(systemHealth, healthChecks)
    };

    // Set HTTP status based on overall health
    let httpStatus = 200;
    if (overallStatus === 'unhealthy') {
      httpStatus = 503;
    } else if (overallStatus === 'degraded') {
      httpStatus = 200; // Still functional but with warnings
    }

    const response = NextResponse.json(healthResponse, { status: httpStatus });
    return addSecurityHeaders(response, request);

  } catch (error) {
    console.error('Health check error:', error);
    
    const response = NextResponse.json(
      { 
        status: 'unhealthy',
        error: 'Health check failed',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
    return addSecurityHeaders(response, request);
  }
}

async function checkDatabase(): Promise<{ status: string; details?: any }> {
  try {
    // Check database connectivity
    // This is a placeholder - in a real implementation, you'd check your actual database
    const dbConnected = true; // Placeholder
    
    if (dbConnected) {
      return {
        status: 'healthy',
        details: {
          connection: 'established',
          response_time: '5ms' // Placeholder
        }
      };
    } else {
      return {
        status: 'unhealthy',
        details: {
          connection: 'failed',
          error: 'Database connection timeout'
        }
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        connection: 'error',
        error: error.message
      }
    };
  }
}

function checkMemory(): { status: string; details?: any } {
  try {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const heapUsagePercent = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);

    let status = 'healthy';
    if (heapUsagePercent > 90) {
      status = 'unhealthy';
    } else if (heapUsagePercent > 75) {
      status = 'degraded';
    }

    return {
      status,
      details: {
        heap_used_mb: heapUsedMB,
        heap_total_mb: heapTotalMB,
        heap_usage_percent: heapUsagePercent,
        external_mb: Math.round(memoryUsage.external / 1024 / 1024)
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      details: {
        error: error.message
      }
    };
  }
}

function generateRecommendations(systemHealth: any, healthChecks: any): string[] {
  const recommendations: string[] = [];

  // Framework recommendations
  if (systemHealth.stats.unresolved > 5) {
    recommendations.push('Review and resolve pending system errors');
  }

  if (systemHealth.stats.total > 100) {
    recommendations.push('Consider clearing old error logs');
  }

  // Database recommendations
  if (healthChecks.database.status !== 'healthy') {
    recommendations.push('Check database connectivity and configuration');
  }

  // Memory recommendations
  if (healthChecks.memory.details.heap_usage_percent > 75) {
    recommendations.push('High memory usage detected - consider optimizing memory usage');
  }

  if (recommendations.length === 0) {
    recommendations.push('System is running optimally');
  }

  return recommendations;
}