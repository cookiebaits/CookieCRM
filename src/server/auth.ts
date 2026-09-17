import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.ts';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'scambaiter-super-secret-key-2026';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  const dbUser = await db.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, name: true, avatarUrl: true, role: true },
  });

  if (!dbUser) {
    return res.status(401).json({ error: 'User not found in database.' });
  }

  // Check if this user matches the configured ADMIN_USER or TESTER_USER env
  const cleanEnv = (val?: string) => (val || '').replace(/^["']|["']$/g, '').trim();
  const adminEnvUser = cleanEnv(process.env.ADMIN_USER).toLowerCase() || 'sbadmin@cookiebaits';
  const testerEnvUser = cleanEnv(process.env.TESTER_USER).toLowerCase();

  const isAuthorizedAdmin =
    (adminEnvUser && dbUser.email.toLowerCase().trim() === adminEnvUser) ||
    dbUser.email.toLowerCase().trim() === 'cookiescambait@gmail.com' ||
    (testerEnvUser && dbUser.email.toLowerCase().trim() === testerEnvUser && testerEnvUser === 'cookiescambait@gmail.com');

  if (isAuthorizedAdmin) {
    dbUser.role = 'admin';
    await db.user.update({ where: { id: dbUser.id }, data: { role: 'admin' } }).catch(() => {});
  } else if (!isAuthorizedAdmin && (dbUser as any).googleId && dbUser.role === 'admin') {
    dbUser.role = 'scambaiter';
  }

  req.user = dbUser;
  next();
}

export function isAdminUser(user: AuthUser | { email?: string; role?: string; googleId?: string | null } | null | undefined): boolean {
  if (!user) return false;
  const userEmail = user.email?.toLowerCase().trim();
  const cleanEnv = (val?: string) => (val || '').replace(/^["']|["']$/g, '').trim();
  const adminEnvUser = cleanEnv(process.env.ADMIN_USER).toLowerCase() || 'sbadmin@cookiebaits';
  const testerEnvUser = cleanEnv(process.env.TESTER_USER).toLowerCase();

  // Strict check: if user email matches configured Dokploy ADMIN_USER env or the applet owner
  if (userEmail && (userEmail === adminEnvUser || userEmail === 'cookiescambait@gmail.com' || (testerEnvUser && userEmail === testerEnvUser && testerEnvUser === 'cookiescambait@gmail.com'))) {
    return true;
  }

  // Google OAuth / Gmail users can NEVER be admin unless their email matches ADMIN_USER in Dokploy or the owner
  if ((user as any).googleId && userEmail !== adminEnvUser && userEmail !== 'cookiescambait@gmail.com') {
    return false;
  }

  const role = (user.role || '').toLowerCase();
  return role === 'admin' || role === 'admin_scambaiter';
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || !isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  next();
}

/**
 * Parses a Google JWT credential (from Google Identity Services / GSI)
 * or creates/updates a user from verified Google payload.
 */
export function parseJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      Buffer.from(base64, 'base64')
        .toString('binary')
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
