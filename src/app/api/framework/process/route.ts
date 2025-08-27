import { NextRequest, NextResponse } from 'next/server';
import { FrameworkController } from '@/framework/controllers/framework-controller';
import { FrameworkInput } from '@/framework/types';
import { SecurityService, addSecurityHeaders } from '@/framework/utils/security';

const frameworkController = new FrameworkController();
const securityService = SecurityService.getInstance();

export async function POST(request: NextRequest) {
  try {
    // Get the raw body first for validation
    const body = await request.json();
    
    // Validate and sanitize input
    const validation = securityService.validateEmailInput(body);
    
    if (!validation.isValid) {
      const response = NextResponse.json(
        { 
          error: 'Invalid input data',
          details: validation.errors,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // Use sanitized input
    const frameworkInput: FrameworkInput = validation.sanitized;

    // Process the input through the framework
    const result = await frameworkController.processInput(frameworkInput);

    // Return the framework output with security headers
    const response = NextResponse.json(result, { status: 200 });
    return addSecurityHeaders(response, request);

  } catch (error) {
    console.error('Framework processing error:', error);
    
    const response = NextResponse.json(
      { 
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
    return addSecurityHeaders(response, request);
  }
}

export async function GET(request: NextRequest) {
  try {
    // Return framework information and capabilities
    const frameworkInfo = {
      name: 'LLM-Controlled Headless Backend Framework',
      version: '1.0.0',
      description: 'Sophisticated framework for processing email content and publishing to frontend systems',
      capabilities: [
        'Email content interpretation',
        'Dynamic frontend connection management',
        'Content transformation and mapping',
        'Multi-frontend publishing execution',
        'Autonomous error handling and recovery'
      ],
      endpoints: {
        process: 'POST /api/framework/process',
        health: 'GET /api/framework/health',
        status: 'GET /api/framework/status',
        connections: 'GET/POST /api/framework/connections',
        errors: 'GET /api/framework/errors'
      },
      supported_auth_types: ['oauth2', 'api_key', 'jwt'],
      supported_content_types: ['article', 'product', 'update', 'announcement', 'other'],
      security: {
        api_key_required: true,
        rate_limiting: true,
        input_validation: true,
        cors_enabled: true
      }
    };

    const response = NextResponse.json(frameworkInfo, { status: 200 });
    return addSecurityHeaders(response, request);

  } catch (error) {
    console.error('Framework info error:', error);
    
    const response = NextResponse.json(
      { error: 'Failed to retrieve framework information' },
      { status: 500 }
    );
    return addSecurityHeaders(response, request);
  }
}