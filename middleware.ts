// middleware.ts
// Next.js middleware for license-based authentication.
// Checks the session cookie on all routes. If absent or invalid:
//   - API routes: returns 401 JSON { error, code }
//   - Page routes: redirects to /activate
//
// Routes that SKIP auth:
//   - /api/license/validate (creates the session)
//   - /activate (license activation page)
//   - /_next/* (Next.js internals)
//   - /favicon.ico, static assets

import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookie } from '@/lib/auth/session'

// Routes that do NOT require authentication
const PUBLIC_PATHS = [
  '/api/license/validate',
  '/activate',
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path))
}

function isStaticPath(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/logo') ||
    pathname.startsWith('/public') ||
    pathname.includes('.') // static files like .svg, .ico, .png
  )
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip auth for static assets and Next.js internals
  if (isStaticPath(pathname)) {
    return NextResponse.next()
  }

  // Skip auth for public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Check session cookie
  const session = await getSessionFromCookie(req)

  if (!session) {
    // API routes: return 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          error: 'Non autorisé. Veuillez activer votre licence.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      )
    }

    // Page routes: redirect to /activate
    const activateUrl = new URL('/activate', req.url)
    return NextResponse.redirect(activateUrl)
  }

  // Session is valid — pass through
  // Inject license_id into request headers for downstream API routes
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-license-id', session.license_id)
  requestHeaders.set('x-license-key', session.license_key)

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

// Matcher: apply middleware to all routes except static files
export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
