import { NextRequest, NextResponse } from 'next/server';

export class SecurityService {
  private static instance: SecurityService;
  private apiKeys: Set<string> = new Set();
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map();

  private constructor() {
    // Initialize with default API key for development
    this.addApiKey('dev-key-123456');
  }

  static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  // API Key Management
  generateApiKey(): string {
    const apiKey = `zak_${this.generateRandomString(32)}`;
    this.addApiKey(apiKey);
    return apiKey;
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  addApiKey(apiKey: string): void {
    this.apiKeys.add(apiKey);
  }

  removeApiKey(apiKey: string): boolean {
    return this.apiKeys.delete(apiKey);
  }

  validateApiKey(apiKey: string): boolean {
    return this.apiKeys.has(apiKey);
  }

  // Rate Limiting
  private getRateLimitKey(request: NextRequest): string {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Simple hash function for edge runtime compatibility
    let hash = 0;
    const str = `${ip}:${userAgent}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  checkRateLimit(request: NextRequest, limit: number = 100, windowMs: number = 60000): boolean {
    const key = this.getRateLimitKey(request);
    const now = Date.now();
    const record = this.rateLimits.get(key);

    if (!record || now > record.resetTime) {
      // New window
      this.rateLimits.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (record.count >= limit) {
      return false; // Rate limit exceeded
    }

    record.count++;
    return true;
  }

  getRateLimitHeaders(request: NextRequest): Record<string, string> {
    const key = this.getRateLimitKey(request);
    const record = this.rateLimits.get(key);
    
    if (!record) {
      return {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '100',
        'X-RateLimit-Reset': Math.floor((Date.now() + 60000) / 1000).toString()
      };
    }

    const remaining = Math.max(0, 100 - record.count);
    const resetTime = Math.floor(record.resetTime / 1000);

    return {
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': resetTime.toString()
    };
  }

  // Input Validation and Sanitization
  validateEmailInput(input: any): { isValid: boolean; sanitized: any; errors: string[] } {
    const errors: string[] = [];
    const sanitized: any = {};

    // Validate email structure
    if (!input.email) {
      errors.push('Email data is required');
    } else {
      sanitized.email = this.sanitizeEmail(input.email);
    }

    // Validate frontend connections
    if (!input.frontend_connections || !Array.isArray(input.frontend_connections)) {
      errors.push('Frontend connections must be an array');
    } else {
      sanitized.frontend_connections = input.frontend_connections.map((conn: any) => 
        this.sanitizeConnection(conn)
      );
    }

    // Validate user context
    if (input.user_context) {
      sanitized.user_context = this.sanitizeUserContext(input.user_context);
    } else {
      sanitized.user_context = {
        id: 'anonymous',
        permissions: [],
        preferences: {}
      };
    }

    // Validate system state
    if (input.system_state) {
      sanitized.system_state = this.sanitizeSystemState(input.system_state);
    } else {
      sanitized.system_state = {
        active_connections: [],
        recent_errors: [],
        total_processed: 0,
        success_rate: 100
      };
    }

    return {
      isValid: errors.length === 0,
      sanitized,
      errors
    };
  }

  private sanitizeEmail(email: any): any {
    return {
      subject: this.sitizeString(email.subject || '', 200),
      body: this.sitizeString(email.body || '', 10000),
      attachments: Array.isArray(email.attachments) ? email.attachments.filter((att: any) => 
        typeof att === 'string' && att.length > 0
      ) : [],
      sender: this.sitizeEmailString(email.sender || ''),
      timestamp: this.sitizeDateString(email.timestamp)
    };
  }

  private sanitizeConnection(connection: any): any {
    return {
      name: this.sitizeString(connection.name || '', 100),
      api_endpoint: this.sitizeUrl(connection.api_endpoint),
      auth_type: ['oauth2', 'api_key', 'jwt'].includes(connection.auth_type) ? connection.auth_type : 'api_key',
      credentials: this.sitizeString(connection.credentials || '', 500),
      api_schema: this.sitizeString(connection.api_schema || '', 5000),
      is_active: Boolean(connection.is_active)
    };
  }

  private sanitizeUserContext(context: any): any {
    return {
      id: this.sitizeString(context.id || 'anonymous', 100),
      permissions: Array.isArray(context.permissions) ? 
        context.permissions.filter((perm: string) => typeof perm === 'string').slice(0, 20) : [],
      preferences: typeof context.preferences === 'object' && context.preferences !== null ? 
        this.sanitizeObject(context.preferences) : {}
    };
  }

  private sanitizeSystemState(state: any): any {
    return {
      active_connections: Array.isArray(state.active_connections) ? 
        state.active_connections.filter((conn: string) => typeof conn === 'string').slice(0, 50) : [],
      recent_errors: Array.isArray(state.recent_errors) ? 
        state.recent_errors.slice(0, 100) : [],
      total_processed: typeof state.total_processed === 'number' ? 
        Math.max(0, Math.floor(state.total_processed)) : 0,
      success_rate: typeof state.success_rate === 'number' ? 
        Math.max(0, Math.min(100, state.success_rate)) : 100
    };
  }

  private sitizeString(str: string, maxLength: number): string {
    if (typeof str !== 'string') return '';
    
    // Remove potentially dangerous characters
    let sanitized = str
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove JavaScript protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();

    // Truncate to max length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
  }

  private sitizeEmailString(email: string): string {
    if (typeof email !== 'string') return '';
    
    // Basic email validation and sanitization
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(email)) {
      return email.toLowerCase().trim();
    }
    
    return '';
  }

  private sitizeUrl(url: string): string {
    if (typeof url !== 'string') return '';
    
    try {
      // Validate URL format
      new URL(url);
      return url.trim();
    } catch {
      return '';
    }
  }

  private sitizeDateString(dateStr: string): string {
    if (typeof dateStr !== 'string') return new Date().toISOString();
    
    try {
      // Validate ISO date format
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch {
      // Fall back to current date
    }
    
    return new Date().toISOString();
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return {};
    
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof key === 'string' && key.length <= 50) {
        if (typeof value === 'string') {
          sanitized[key] = this.sitizeString(value, 500);
        } else if (typeof value === 'number') {
          sanitized[key] = isFinite(value) ? value : 0;
        } else if (typeof value === 'boolean') {
          sanitized[key] = value;
        } else if (Array.isArray(value)) {
          sanitized[key] = value.slice(0, 20).map(item => 
            typeof item === 'string' ? this.sitizeString(item, 200) : item
          );
        }
      }
    }
    
    return sanitized;
  }

  // Security Headers
  getSecurityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
    };
  }

  // CORS Configuration
  validateOrigin(request: NextRequest): boolean {
    const origin = request.headers.get('origin');
    if (!origin) return true; // Same-origin requests
    
    const allowedOrigins = [
      'http://localhost:3000',
      'https://localhost:3000',
      process.env.NEXT_PUBLIC_APP_URL
    ].filter(Boolean);

    return allowedOrigins.includes(origin);
  }

  getCorsHeaders(origin: string): Record<string, string> {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400'
    };
  }

  // Cleanup expired rate limit records
  cleanupRateLimits(): void {
    const now = Date.now();
    for (const [key, record] of this.rateLimits.entries()) {
      if (now > record.resetTime) {
        this.rateLimits.delete(key);
      }
    }
  }
}

// Middleware function
export async function securityMiddleware(request: NextRequest): Promise<NextResponse | null> {
  const securityService = SecurityService.getInstance();

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('origin') || '*';
    const corsHeaders = securityService.getCorsHeaders(origin);
    
    return new NextResponse(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  // Validate CORS
  const origin = request.headers.get('origin');
  if (origin && !securityService.validateOrigin(request)) {
    return NextResponse.json(
      { error: 'Origin not allowed' },
      { status: 403 }
    );
  }

  // Check rate limiting
  if (!securityService.checkRateLimit(request)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { 
        status: 429,
        headers: securityService.getRateLimitHeaders(request)
      }
    );
  }

  // Validate API key for protected routes
  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization');
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/api/framework/');
  
  if (isProtectedRoute && !securityService.validateApiKey(apiKey || '')) {
    return NextResponse.json(
      { error: 'Invalid or missing API key' },
      { status: 401 }
    );
  }

  // Add security headers to response
  const securityHeaders = securityService.getSecurityHeaders();
  const rateLimitHeaders = securityService.getRateLimitHeaders(request);
  
  // Continue with the request - headers will be added by the route handler
  return null;
}

// Utility function to add security headers to responses
export function addSecurityHeaders(response: NextResponse, request: NextRequest): NextResponse {
  const securityService = SecurityService.getInstance();
  
  // Add security headers
  const securityHeaders = securityService.getSecurityHeaders();
  const rateLimitHeaders = securityService.getRateLimitHeaders(request);
  
  // Add CORS headers if origin is present
  const origin = request.headers.get('origin');
  const corsHeaders = origin ? securityService.getCorsHeaders(origin) : {};
  
  // Add all headers to response
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  Object.entries(rateLimitHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}