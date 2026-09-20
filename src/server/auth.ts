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
  hasAcceptedTerms?: boolean;
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

export const PRIMARY_ADMIN_EMAIL = 'cookiescambait@gmail.com';

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

  let dbUser = await db.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, name: true, avatarUrl: true, role: true, hasAcceptedTerms: true },
  });

  if (!dbUser && payload.email) {
    // Try finding by email if ID lookup fails
    dbUser = await db.user.findUnique({
      where: { email: payload.email },
      select: { id: true, email: true, name: true, avatarUrl: true, role: true, hasAcceptedTerms: true },
    });
  }

  if (!dbUser && payload.email) {
    // Self-healing: reconstruct session user if database was reset or cleared
    const isPrimaryAdmin = payload.email.toLowerCase().trim() === PRIMARY_ADMIN_EMAIL;
    dbUser = await db.user.create({
      data: {
        id: payload.id,
        email: payload.email.toLowerCase().trim(),
        name: payload.name || 'Scambaiter Agent',
        role: isPrimaryAdmin ? 'admin' : 'user',
        isActivated: true,
      },
      select: { id: true, email: true, name: true, avatarUrl: true, role: true, hasAcceptedTerms: true },
    });
  }

  if (!dbUser) {
    return res.status(401).json({ error: 'User not found in database.' });
  }

  // Sole administrator is cookiescambait@gmail.com. All other accounts are standard users.
  const isPrimaryAdmin = dbUser.email.toLowerCase().trim() === PRIMARY_ADMIN_EMAIL;

  if (isPrimaryAdmin) {
    dbUser.role = 'admin';
    await db.user.update({ where: { id: dbUser.id }, data: { role: 'admin' } }).catch(() => {});
  } else {
    dbUser.role = 'user';
    if (dbUser.role === 'admin') {
      await db.user.update({ where: { id: dbUser.id }, data: { role: 'user' } }).catch(() => {});
    }
  }

  req.user = dbUser;
  next();
}

export function isAdminUser(user: AuthUser | { email?: string; role?: string; googleId?: string | null } | null | undefined): boolean {
  if (!user || !user.email) return false;
  return user.email.toLowerCase().trim() === PRIMARY_ADMIN_EMAIL;
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
