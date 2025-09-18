import { NextRequest, NextResponse } from 'next/server';
import { CSP } from '@/lib/security';

/**
 * Next.js middleware for security headers and CSP nonce generation
 */
export function middleware(request: NextRequest) {
  // Generate a cryptographically secure nonce for CSP
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Create response
  const response = NextResponse.next();

  // Set security headers
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Content Security Policy - adjust for development vs production
  const cspPolicy = isDevelopment 
    ? [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`, // unsafe-eval for dev hot reload
        `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
        "img-src 'self' data: https: blob:",
        "font-src 'self' data:",
        "connect-src 'self' ws: wss:", // WebSocket for dev hot reload
        "frame-ancestors 'none'"
      ].join('; ')
    : CSP.generatePolicyString(nonce);

  response.headers.set('Content-Security-Policy', cspPolicy);

  // Additional security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // HSTS for production
  if (!isDevelopment) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Make nonce available to the app via custom header
  response.headers.set('x-csp-nonce', nonce);

  return response;
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};