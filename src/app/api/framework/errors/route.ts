import { NextRequest, NextResponse } from 'next/server';
import { FrameworkController } from '@/framework/controllers/framework-controller';
import { addSecurityHeaders } from '@/framework/utils/security';

const frameworkController = new FrameworkController();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const component = searchParams.get('component');
    const severity = searchParams.get('severity');
    const resolved = searchParams.get('resolved');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get system health to access errors
    const systemHealth = frameworkController.getSystemHealth();
    let errors = systemHealth.errors;

    // Filter by component if specified
    if (component) {
      errors = errors.filter(error => error.component === component);
    }

    // Filter by severity if specified
    if (severity) {
      errors = errors.filter(error => error.severity === severity);
    }

    // Filter by resolved status if specified
    if (resolved !== null) {
      const isResolved = resolved === 'true';
      errors = errors.filter(error => error.resolved === isResolved);
    }

    // Apply pagination
    const total = errors.length;
    const paginatedErrors = errors.slice(offset, offset + limit);

    // Get error statistics
    const errorStats = systemHealth.stats;

    const response = NextResponse.json({
      errors: paginatedErrors,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total
      },
      statistics: {
        total_errors: errorStats.total,
        resolved_errors: errorStats.resolved,
        unresolved_errors: errorStats.unresolved,
        by_component: errorStats.byComponent,
        by_severity: errorStats.bySeverity
      },
      filters: {
        component,
        severity,
        resolved,
        limit,
        offset
      },
      timestamp: new Date().toISOString()
    }, { status: 200 });
    return addSecurityHeaders(response, request);

  } catch (error) {
    console.error('Error retrieving errors:', error);
    
    const response = NextResponse.json(
      { 
        error: 'Failed to retrieve errors',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
    return addSecurityHeaders(response, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.error || !body.component) {
      const response = NextResponse.json(
        { error: 'Missing required fields: error and component' },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // Create error object
    const error = {
      timestamp: body.timestamp || new Date().toISOString(),
      error: body.error,
      severity: body.severity || 'medium',
      component: body.component,
      resolved: body.resolved || false
    };

    // In a real implementation, you would save this error to a database
    // For now, we'll just return success
    
    const response = NextResponse.json({
      message: 'Error logged successfully',
      error,
      timestamp: new Date().toISOString()
    }, { status: 201 });
    return addSecurityHeaders(response, request);

  } catch (error) {
    console.error('Error logging error:', error);
    
    const response = NextResponse.json(
      { 
        error: 'Failed to log error',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
    return addSecurityHeaders(response, request);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.timestamp || !body.component) {
      const response = NextResponse.json(
        { error: 'Missing required fields: timestamp and component' },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // In a real implementation, you would update the error in the database
    // For now, we'll just return success
    
    const response = NextResponse.json({
      message: 'Error updated successfully',
      error: {
        timestamp: body.timestamp,
        component: body.component,
        resolved: body.resolved
      },
      timestamp: new Date().toISOString()
    }, { status: 200 });
    return addSecurityHeaders(response, request);

  } catch (error) {
    console.error('Error updating error:', error);
    
    const response = NextResponse.json(
      { 
        error: 'Failed to update error',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
    return addSecurityHeaders(response, request);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const component = searchParams.get('component');
    const resolved = searchParams.get('resolved');

    // In a real implementation, you would delete errors from the database
    // For now, we'll just return success
    
    let message = 'Errors cleared successfully';
    if (component) {
      message = `Errors for component '${component}' cleared successfully`;
    }
    if (resolved !== null) {
      message += ` with resolved status: ${resolved}`;
    }

    const response = NextResponse.json({
      message,
      filters: {
        component,
        resolved
      },
      timestamp: new Date().toISOString()
    }, { status: 200 });
    return addSecurityHeaders(response, request);

  } catch (error) {
    console.error('Error clearing errors:', error);
    
    const response = NextResponse.json(
      { 
        error: 'Failed to clear errors',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
    return addSecurityHeaders(response, request);
  }
}