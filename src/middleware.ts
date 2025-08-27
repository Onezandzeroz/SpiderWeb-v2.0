import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { securityMiddleware, addSecurityHeaders } from '@/framework/utils/security';

export async function middleware(request: NextRequest) {
  // Apply security checks
  const securityResult = await securityMiddleware(request);
  
  if (securityResult) {
    return securityResult;
  }

  // Continue with the request
  const response = NextResponse.next();
  
  // Add security headers to the response
  return addSecurityHeaders(response, request);
}

export const config = {
  matcher: [
    // Apply to all API routes
    '/api/:path*',
    // Apply to the dashboard
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};