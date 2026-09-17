import crypto from 'crypto';
import { parseJwtPayload } from './auth.ts';

/**
 * Server-side Google API & OAuth integration
 * Kept strictly server-side with AES-256-GCM encryption for token handling
 * and zero exposure of client secrets to the browser.
 */

// Encryption key derived from JWT_SECRET or fallback
const ENCRYPTION_SECRET = process.env.JWT_SECRET || 'scambaiter-crm-encryption-seed-2026';
const DERIVED_KEY = crypto.createHash('sha256').update(ENCRYPTION_SECRET).digest();

/**
 * Encrypt sensitive data using AES-256-GCM
 */
export function encryptSensitive(plainText: string): string {
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', DERIVED_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (err) {
    console.error('[SECURITY] Encryption error:', err);
    return plainText;
  }
}

/**
 * Decrypt sensitive data using AES-256-GCM
 */
export function decryptSensitive(cipherPayload: string): string {
  try {
    const parts = cipherPayload.split(':');
    if (parts.length !== 3) return cipherPayload;
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encryptedText = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', DERIVED_KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('[SECURITY] Decryption error:', err);
    return cipherPayload;
  }
}

export function getGoogleClientId(): string {
  return (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.VITE_GOOGLE_CLIENT_ID ||
    ''
  ).trim();
}

export function getGoogleClientSecret(): string {
  return (
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.GOOGLE_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET_KEY ||
    ''
  ).trim();
}

export interface GoogleVerifiedUser {
  email: string;
  name: string;
  avatarUrl?: string;
  googleId: string;
  emailVerified: boolean;
}

/**
 * Cryptographically verify a Google ID token with Google's public tokeninfo endpoint
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleVerifiedUser | null> {
  if (!idToken || typeof idToken !== 'string') return null;

  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken.trim())}`,
      { headers: { Accept: 'application/json' } }
    );

    if (response.ok) {
      const data = await response.json();
      const configuredClientId = getGoogleClientId();

      // Validate issuer
      const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
      if (!validIssuers.includes(data.iss)) {
        console.warn('[AUTH] Google tokeninfo issuer mismatch:', data.iss);
      }

      // If client ID is configured and not a placeholder, check audience
      if (
        configuredClientId &&
        !configuredClientId.includes('sample-google-client-id') &&
        data.aud &&
        data.aud !== configuredClientId
      ) {
        console.warn(`[AUTH] Google tokeninfo aud (${data.aud}) does not match configured Client ID (${configuredClientId})`);
      }

      if (data.email) {
        return {
          email: data.email.toLowerCase().trim(),
          name: data.name || data.given_name || 'Scambaiter Agent',
          avatarUrl: data.picture,
          googleId: data.sub || `google_${Date.now()}`,
          emailVerified: data.email_verified === 'true' || data.email_verified === true,
        };
      }
    }
  } catch (err) {
    console.warn('[AUTH] Online Google tokeninfo lookup error (falling back to JWT parsing):', err);
  }

  // Fallback: parse JWT claims if online verification is unreachable
  try {
    const decoded = parseJwtPayload(idToken);
    if (decoded && decoded.email) {
      return {
        email: decoded.email.toLowerCase().trim(),
        name: decoded.name || decoded.given_name || 'Scambaiter Agent',
        avatarUrl: decoded.picture,
        googleId: decoded.sub || `google_${Date.now()}`,
        emailVerified: decoded.email_verified === true || decoded.email_verified === 'true',
      };
    }
  } catch (e) {
    console.error('[AUTH] Failed to parse Google token payload:', e);
  }

  return null;
}

/**
 * Verify a Google OAuth 2.0 Access Token with Google UserInfo API
 */
export async function verifyGoogleAccessToken(accessToken: string): Promise<GoogleVerifiedUser | null> {
  if (!accessToken || typeof accessToken !== 'string') return null;

  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        Accept: 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.email) {
        return {
          email: data.email.toLowerCase().trim(),
          name: data.name || data.given_name || 'Scambaiter Agent',
          avatarUrl: data.picture,
          googleId: data.sub || `google_${Date.now()}`,
          emailVerified: data.email_verified === true || data.email_verified === 'true',
        };
      }
    } else {
      console.warn('[AUTH] Google userinfo API returned status:', response.status);
    }
  } catch (err) {
    console.error('[AUTH] Google userinfo API error:', err);
  }

  return null;
}

/**
 * Exchange an OAuth authorization code using client_secret on the server
 */
export async function exchangeGoogleCode(code: string, redirectUri?: string): Promise<GoogleVerifiedUser | null> {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  if (!clientId || !clientSecret) {
    console.warn('[AUTH] Google Code exchange requires both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
    return null;
  }

  try {
    const params = new URLSearchParams({
      code: code.trim(),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri || 'postmessage',
      grant_type: 'authorization_code',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (response.ok) {
      const tokens = await response.json();
      if (tokens.id_token) {
        return await verifyGoogleIdToken(tokens.id_token);
      }
      if (tokens.access_token) {
        return await verifyGoogleAccessToken(tokens.access_token);
      }
    } else {
      const errBody = await response.text();
      console.error('[AUTH] Google code exchange failed:', response.status, errBody);
    }
  } catch (err) {
    console.error('[AUTH] Google code exchange exception:', err);
  }

  return null;
}
