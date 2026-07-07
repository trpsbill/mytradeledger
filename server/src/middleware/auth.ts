import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { tokenService } from '../services/tokenService';

const SESSION_MAX_LIFETIME_MS = parseInt(process.env.SESSION_MAX_LIFETIME_MS ?? '') || 8 * 60 * 60 * 1000;

export interface AuthUser {
  userId: string;
  email: string;
  loginAt?: number; // seconds since epoch — present on session JWTs
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function verifyJwt(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser;
    if (payload.loginAt !== undefined) {
      const sessionAgeMs = Date.now() - payload.loginAt * 1000;
      if (sessionAgeMs > SESSION_MAX_LIFETIME_MS) return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// Accepts either a valid session JWT or a valid PAT (mtl_ prefix).
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);

  try {
    if (token.startsWith('mtl_')) {
      const user = await tokenService.validate(token);
      if (!user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      req.user = user;
      return next();
    }

    const payload = verifyJwt(token);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Accepts ONLY a session JWT. PATs are rejected.
// Used for token-management endpoints to limit blast radius.
export function requireSessionAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  if (token.startsWith('mtl_')) {
    return res.status(401).json({ error: 'Token management requires session authentication' });
  }

  const payload = verifyJwt(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = payload;
  next();
}
