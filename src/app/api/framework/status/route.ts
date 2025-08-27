import { NextRequest, NextResponse } from 'next/server';
import { FrameworkController } from '@/framework/controllers/framework-controller';
import { addSecurityHeaders } from '@/framework/utils/security';

const frameworkController = new FrameworkController();

export async function GET(request: NextRequest) {
  try {
    // Get comprehensive system status
    const systemHealth = frameworkController.getSystemHealth();
    
    // Get detailed system information
    const systemStatus = {
      framework: {
        name: 'LLM-Controlled Headless Backend Framework',
        version: '1.0.0',
        status: systemHealth.status,
        uptime: process.uptime(),
        start_time: new Date(Date.now() - process.uptime() * 1000).toISOString()
      },
      performance: {
        memory_usage: process.memoryUsage(),
        cpu_usage: process.cpuUsage(),
        platform: process.platform,
        arch: process.arch,
        node_version: process.version
      },
      processing: {
        total_processed: systemHealth.stats.total,
        success_rate: systemHealth.stats.success_rate,
        error_count: systemHealth.stats.unresolved,
        recent_errors: systemHealth.errors.slice(-10) // Last 10 errors
      },
      connections: {
        active_count: 0, // This would be populated from actual connection data
        total_count: 0,
        recent_activity: []
      },
      health: {
        overall: systemHealth.status,
        components: {
          email_interpretation: getComponentHealth(systemHealth.errors, 'EmailInterpretationService'),
          frontend_connection: getComponentHealth(systemHealth.errors, 'FrontendConnectionService'),
          content_transformation: getComponentHealth(systemHealth.errors, 'ContentTransformationService'),
          publishing_execution: getComponentHealth(systemHealth.errors, 'PublishingExecutionService'),
          error_handling: getComponentHealth(systemHealth.errors, 'ErrorHandlingService')
        }
      },
      metrics: {
        requests_today: 0, // Would be populated from actual metrics
        requests_this_hour: 0,
        average_response_time: 0,
        last_activity: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    const response = NextResponse.json(systemStatus, { status: 200 });
    return addSecurityHeaders(response, request);

  } catch (error) {
    console.error('System status error:', error);
    
    const response = NextResponse.json(
      { 
        error: 'Failed to retrieve system status',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
    return addSecurityHeaders(response, request);
  }
}

function getComponentHealth(errors: any[], componentName: string): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  error_count: number;
  last_error?: any;
} {
  const componentErrors = errors.filter(error => error.component === componentName);
  
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (componentErrors.length > 5) {
    status = 'unhealthy';
  } else if (componentErrors.length > 2) {
    status = 'degraded';
  }

  const lastError = componentErrors.length > 0 ? componentErrors[componentErrors.length - 1] : undefined;

  return {
    status,
    error_count: componentErrors.length,
    last_error: lastError ? {
      timestamp: lastError.timestamp,
      error: lastError.error,
      severity: lastError.severity,
      resolved: lastError.resolved
    } : undefined
  };
}