import { Request, Response } from 'express';
import { authService, signToken } from '../services/authService';
import { demoService } from '../services/demoService';
import { issuePowChallenge } from '../middleware/powChallenge';
import { getLogtail } from '../config/logger';

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

      const { email, password, marketingOptIn } = req.body;

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

      const { user, token } = await authService.register(
        email,
        password,
        Boolean(marketingOptIn)
      );

      getLogtail()?.info('user signup', {
        source: 'server',
        event: 'signup',
        userId: user.id,
        email: user.email,
      }).catch(() => {});

      res.status(201).json({
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            isPaid: user.isPaid,
            emailVerified: Boolean(user.emailVerifiedAt),
            isDemo: user.isDemo,
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
            isPaid: user.isPaid,
            emailVerified: Boolean(user.emailVerifiedAt),
            isDemo: user.isDemo,
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

  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (email && typeof email === 'string') {
        await authService.requestPasswordReset(email);
      }

      // Always return a generic success response to avoid account enumeration.
      res.json({ ok: true });
    } catch (error) {
      console.error('Forgot password error:', error);
      // Still return a generic response so the outcome can't be inferred.
      res.json({ ok: true });
    }
  },

  async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Reset token is required' });
      }
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      await authService.resetPassword(token, newPassword);

      res.json({ ok: true });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'INVALID_RESET_TOKEN') {
        return res.status(400).json({ error: 'This reset link is invalid or has expired' });
      }
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  },

  async me(req: Request, res: Response) {
    try {
      const user = await authService.getById(req.user!.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const { emailVerifiedAt, ...rest } = user;
      res.json({ data: { ...rest, emailVerified: Boolean(emailVerifiedAt) } });
    } catch (error) {
      console.error('Me error:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  },

  async verifyEmail(req: Request, res: Response) {
    try {
      const { token } = req.body;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Verification token is required' });
      }

      await authService.verifyEmail(token);

      res.json({ ok: true });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'INVALID_VERIFICATION_TOKEN') {
        return res.status(400).json({ error: 'This verification link is invalid or has expired' });
      }
      console.error('Verify email error:', error);
      res.status(500).json({ error: 'Failed to verify email' });
    }
  },

  async resendVerification(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (email && typeof email === 'string') {
        await authService.resendVerification(email);
      }

      // Always return a generic success response to avoid account enumeration.
      res.json({ ok: true });
    } catch (error) {
      console.error('Resend verification error:', error);
      // Still return a generic response so the outcome can't be inferred.
      res.json({ ok: true });
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

  async demoLogin(req: Request, res: Response) {
    try {
      const user = await demoService.createDemoUser();
      const token = signToken(user);

      getLogtail()?.info('demo session started', {
        source: 'server',
        event: 'demo_start',
        userId: user.id,
      }).catch(() => {});

      res.status(201).json({
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            isPaid: user.isPaid,
            emailVerified: true,
            isDemo: true,
          },
        },
      });
    } catch (error) {
      console.error('Demo login error:', error);
      res.status(500).json({ error: 'Failed to start demo session' });
    }
  },

  // Called on logout so a demo user's data is cleaned up immediately rather
  // than waiting for the scheduled sweep. No-ops harmlessly for a real user.
  async deleteDemoSession(req: Request, res: Response) {
    try {
      await demoService.deleteDemoUser(req.user!.userId);
      res.status(204).end();
    } catch (error) {
      console.error('Delete demo session error:', error);
      res.status(500).json({ error: 'Failed to end demo session' });
    }
  },

  async purgeDemoUsers(req: Request, res: Response) {
    try {
      const result = await demoService.cleanupExpiredDemoUsers();
      res.json({ data: result });
    } catch (error) {
      console.error('Purge demo users error:', error);
      res.status(500).json({ error: 'Failed to purge demo users' });
    }
  },

  async purgeTokens(req: Request, res: Response) {
    try {
      const result = await authService.purgeTokens();
      res.json({ data: result });
    } catch (error) {
      console.error('Purge tokens error:', error);
      res.status(500).json({ error: 'Failed to purge tokens' });
    }
  },
};
