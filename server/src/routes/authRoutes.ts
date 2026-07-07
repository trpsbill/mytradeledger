import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/authController';
import { requireAuth, requireSessionAuth } from '../middleware/auth';
import {
  forgotPasswordLimiter,
  loginIpLimiter,
  makeAccountLoginLimiter,
  registerLimiter,
  resendVerificationLimiter,
  resetPasswordLimiter,
  verifyEmailLimiter,
} from '../middleware/authRateLimit';
import { challengeAfterFailures } from '../middleware/challenge';
import { powChallengeProvider } from '../middleware/powChallenge';
import tokenRoutes from './tokenRoutes';

const router = Router();

// Admin API key guard for maintenance endpoints.
function requireAdminKey(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    return res.status(501).json({ error: 'Admin API key not configured' });
  }
  const provided = req.headers['x-admin-key'];
  if (!provided || provided !== adminKey) {
    return res.status(401).json({ error: 'Invalid or missing admin key' });
  }
  next();
}

// Per-IP throttle on challenge issuance so the endpoint can't be abused to make
// the server mint/sign work en masse. Its own budget (not shared with the auth
// limiters) so a user re-solving on the failure path can't exhaust an unrelated
// flow: a failing user legitimately fetches a fresh puzzle on each retry.
const challengeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'Too many challenge requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Per-account login lock: throttles failed logins keyed on the email, so a
// distributed credential-stuffing run against one account is stopped even when
// every request comes from a different IP. Constructed once here.
const loginAccountLimiter = makeAccountLoginLimiter();

// Failure-triggered anti-automation challenge, backed by the self-hosted
// proof-of-work provider (TRE-26). Active by default; set CHALLENGE_ENABLED=false
// to fully restore the prior, challenge-free behavior (see middleware/challenge.ts).
const loginChallenge = challengeAfterFailures({ provider: powChallengeProvider });
const registerChallenge = challengeAfterFailures({ provider: powChallengeProvider });
const forgotPasswordChallenge = challengeAfterFailures({ provider: powChallengeProvider });

// Login is guarded by both the per-IP and per-account limiters; the account
// limiter sits second so a missing/invalid email is still caught by the IP layer.
router.get('/config', authController.config);
router.post('/login', loginIpLimiter, loginAccountLimiter, loginChallenge, authController.login);
router.post('/register', registerLimiter, registerChallenge, authController.register);
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  forgotPasswordChallenge,
  authController.forgotPassword
);
router.post('/reset-password', resetPasswordLimiter, authController.resetPassword);
router.post('/verify-email', verifyEmailLimiter, authController.verifyEmail);
router.post('/resend-verification', resendVerificationLimiter, authController.resendVerification);
router.get('/challenge', challengeLimiter, authController.challenge);
router.get('/me', requireAuth, authController.me);

// Session refresh: issues a new short-lived JWT if the current session JWT is
// still valid and within the absolute lifetime cap. PATs are rejected (they
// have their own expiry). Rate-limited generously since active users hit this
// every idle-timeout window.
// Note: keyed by IP (express-rate-limit default). Acceptable for a
// single-instance personal deployment; revisit if multi-user/multi-tenant.
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many refresh requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
router.post('/refresh', refreshLimiter, requireSessionAuth, authController.refresh);

router.use('/tokens', tokenRoutes);

// Maintenance: purge used/expired tokens. Guarded by ADMIN_API_KEY env var (not
// a session/PAT auth wall) so it can be called from a cron job or admin script
// without a user session.
const purgeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many purge requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
router.post('/purge-tokens', purgeLimiter, requireAdminKey, authController.purgeTokens);

export default router;
