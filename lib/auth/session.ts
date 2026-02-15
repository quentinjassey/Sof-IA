// lib/auth/session.ts
// Session management using jose for JWT-based encrypted cookies
// Dependency: jose (npm install jose)
//
// Session cookie:
//   - Name: sofia_session
//   - httpOnly, secure (prod), sameSite=strict, path=/
//   - Encrypted with SESSION_SECRET from env using JWE (A256GCM + dir)
//   - Contains: { license_key, license_id, activated_at }

import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const COOKIE_NAME = 'sofia_session'
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds

export interface SessionData {
  license_key: string
  license_id: string
  activated_at: string
}

interface SessionPayload extends JWTPayload {
  license_key: string
  license_id: string
  activated_at: string
}

/**
 * Derives a 256-bit secret key from the SESSION_SECRET env variable.
 * Uses TextEncoder to convert the secret string to bytes, then takes
 * the first 32 bytes (padding with zeros if necessary).
 */
function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET doit contenir au moins 32 caractères.'
    )
  }
  // Encode the secret and ensure we have exactly 32 bytes
  const encoded = new TextEncoder().encode(secret)
  const key = new Uint8Array(32)
  key.set(encoded.slice(0, 32))
  return key
}

/**
 * Creates an encrypted session JWT token from session data.
 * Returns the token string (to be stored in a cookie).
 */
async function encryptSession(data: SessionData): Promise<string> {
  const secretKey = getSecretKey()

  return new SignJWT({
    license_key: data.license_key,
    license_id: data.license_id,
    activated_at: data.activated_at,
  } as SessionPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE}s`)
    .setIssuer('sofia-poc')
    .sign(secretKey)
}

/**
 * Decrypts and verifies a session JWT token.
 * Returns the session data if valid, null if invalid/expired.
 */
async function decryptSession(token: string): Promise<SessionData | null> {
  try {
    const secretKey = getSecretKey()
    const { payload } = await jwtVerify(token, secretKey, {
      issuer: 'sofia-poc',
    })

    const sessionPayload = payload as SessionPayload

    if (!sessionPayload.license_key || !sessionPayload.license_id) {
      return null
    }

    return {
      license_key: sessionPayload.license_key,
      license_id: sessionPayload.license_id,
      activated_at: sessionPayload.activated_at,
    }
  } catch {
    // Token invalid, expired, or tampered with
    return null
  }
}

/**
 * Creates a session cookie with the given session data.
 * Uses Next.js cookies() API for server components / API routes.
 * Returns the Set-Cookie header value for use in NextResponse.
 */
export async function createSessionCookie(
  data: SessionData
): Promise<{ name: string; value: string; options: Record<string, unknown> }> {
  const token = await encryptSession(data)
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict' as const,
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    },
  }
}

/**
 * Retrieves and decrypts the session from the request cookie.
 * For use in middleware (NextRequest) or API routes.
 */
export async function getSessionFromCookie(
  req: NextRequest
): Promise<SessionData | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    return null
  }
  return decryptSession(token)
}

/**
 * Retrieves and decrypts the session from cookies() (server components / API routes).
 * Uses the Next.js cookies() helper.
 */
export async function getSessionFromServerCookies(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) {
    return null
  }
  return decryptSession(token)
}

/**
 * Returns cookie attributes to clear the session cookie.
 * The cookie is cleared by setting maxAge to 0.
 */
export function clearSessionCookie(): {
  name: string
  value: string
  options: Record<string, unknown>
} {
  return {
    name: COOKIE_NAME,
    value: '',
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
      maxAge: 0,
    },
  }
}

export { COOKIE_NAME }
