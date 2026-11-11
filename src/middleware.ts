// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { ROLES } from '@/types/roles';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Odstranění potenciálně nebezpečných headerů (obrana proti CVE-2025-29927)
  const headers = new Headers(request.headers);
  headers.delete('x-middleware-subrequest');
  headers.delete('x-middleware-invoke');

  // Normalizace cesty - case-insensitive kontrola
  const normalizedPath = pathname.toLowerCase();

  // Zkontrolovat token s error handling
  let token = null;
  try {
    token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });
  } catch (error) {
    // JWT decryption failed - pravděpodobně kvůli změně NEXTAUTH_SECRET nebo starým cookies

    // Vyčistit staré cookies
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    loginUrl.searchParams.set('error', 'SessionExpired');

    const response = NextResponse.redirect(loginUrl);

    // Vymazat všechny auth cookies
    response.cookies.delete('next-auth.session-token');
    response.cookies.delete('next-auth.csrf-token');
    response.cookies.delete('next-auth.callback-url');
    response.cookies.delete('__Secure-next-auth.session-token');
    response.cookies.delete('__Secure-next-auth.csrf-token');
    response.cookies.delete('__Secure-next-auth.callback-url');

    // Přidání základních security headerů
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');

    return response;
  }

  // Check for missing token, missing id, or expired session
  // token.exp is the JWT expiration timestamp (Unix time in seconds)
  const tokenExp = typeof token?.exp === 'number' ? token.exp : null;
  const isExpired = tokenExp && Date.now() >= tokenExp * 1000;

  if (!token || !token.id || isExpired) {
    // Clear cookies and redirect to login with appropriate error
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);

    if (isExpired) {
      loginUrl.searchParams.set('error', 'SessionExpired');
    }

    const response = NextResponse.redirect(loginUrl);

    // Clear auth cookies for expired sessions
    if (isExpired) {
      response.cookies.delete('next-auth.session-token');
      response.cookies.delete('next-auth.csrf-token');
      response.cookies.delete('next-auth.callback-url');
      response.cookies.delete('__Secure-next-auth.session-token');
      response.cookies.delete('__Secure-next-auth.csrf-token');
      response.cookies.delete('__Secure-next-auth.callback-url');
    }

    // Security headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');

    return response;
  }

  // Role-based access control
  const userRole = token.role || ROLES.WORKER;

  // Admin routes
  if (normalizedPath.startsWith('/admin')) {
    if (userRole !== ROLES.ADMIN) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Trainer routes
  if (normalizedPath.startsWith('/trainer')) {
    if (userRole !== ROLES.ADMIN && userRole !== ROLES.TRAINER) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Admin API routes
  if (normalizedPath.startsWith('/api/admin')) {
    if (userRole !== ROLES.ADMIN) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }
  }

  // Trainer API routes
  if (normalizedPath.startsWith('/api/trainer')) {
    if (userRole !== ROLES.ADMIN && userRole !== ROLES.TRAINER) {
      return NextResponse.json(
        { error: 'Forbidden - Trainer access required' },
        { status: 403 }
      );
    }
  }

  // Pro autorizované požadavky - přidání security headerů
  const response = NextResponse.next({ headers });
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  // Aplikuje middleware POUZE na tyto konkrétní cesty
  // Vynechává: login, api/auth, _next, všechny statické soubory
  matcher: [
    /*
     * Match all request paths except:
     * - api/auth (auth endpoints)
     * - api/health (liveness sonda bez přihlášení, nevrací žádná data)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt, sitemap.xml (metadata files)
     * - public assets (images: .svg, .png, .jpg, .jpeg, .gif, .webp, .ico)
     * - public assets (fonts: .otf, .ttf, .woff, .woff2)
     * - login page
     */
    '/((?!api/auth|api/health|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|login|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|otf|ttf|woff|woff2)).*)',
    '/'
  ]
};
