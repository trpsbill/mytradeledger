import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { issuePowChallenge } from '../middleware/powChallenge';

export const authController = {
  // Issues a fresh proof-of-work challenge for the client to solve. Public: the
  // puzzle is worthless without the work, and solving costs the caller CPU. Used
  // by the forms only after the server has demanded a challenge (403).
  challenge(_req: Request, res: Response) {
    res.json(issuePowChallenge());
  },

  config(_req: Request, res: Response) {
    const signupsEnabled = process.env.SIGNUP_ENABLED !== 'false';
    res.json({ data: { signupsEnabled } });
  },

  async register(req: Request, res: Response) {
    try {
      if (process.env.SIGNUP_ENABLED === 'false') {
        return res.status(403).json({ error: 'Signups are currently closed.' });
      }

      const { email, password } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required' });
      }
      if (!password || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
      }

      const { user, token } = await authService.register(email, password);

      res.status(201).json({
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
          },
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'EMAIL_IN_USE') {
        return res.status(409).json({ error: 'An account with that email already exists' });
      }
      console.error('Register error:', error);
      res.status(500).json({ error: 'Failed to create account' });
    }
  },

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const { user, token } = await authService.login(email, password);

      res.json({
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
          },
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
        return res.status(401).json({ error: 'Incorrect email or password' });
      }
      console.error('Login error:', error);
      res.status(500).json({ error: 'Failed to log in' });
    }
  },

  async me(req: Request, res: Response) {
    try {
      const user = await authService.getById(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ data: user });
    } catch (error) {
      console.error('Me error:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  },

  async refresh(req: Request, res: Response) {
    try {
      const token = await authService.refreshSession(req.user!.userId, req.user!.loginAt);
      res.json({ data: { token } });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'SESSION_MAX_LIFETIME_EXCEEDED') {
        return res.status(401).json({ error: 'Session has expired. Please log in again.' });
      }
      if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      console.error('Refresh error:', error);
      res.status(500).json({ error: 'Failed to refresh session' });
    }
  },
};
