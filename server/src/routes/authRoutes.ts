import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/authController';
import { requireAuth, requireSessionAuth } from '../middleware/auth';
import {
  loginIpLimiter,
  makeAccountLoginLimiter,
  registerLimiter,
} from '../middleware/authRateLimit';
import { challengeAfterFailures } from '../middleware/challenge';
import { powChallengeProvider } from '../middleware/powChallenge';
import tokenRoutes from './tokenRoutes';

const router = Router();

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
// proof-of-work provider. Active by default; set CHALLENGE_ENABLED=false
// to fully restore the prior, challenge-free behavior (see middleware/challenge.ts).
const loginChallenge = challengeAfterFailures({ provider: powChallengeProvider });
const registerChallenge = challengeAfterFailures({ provider: powChallengeProvider });

// Login is guarded by both the per-IP and per-account limiters; the account
// limiter sits second so a missing/invalid email is still caught by the IP layer.
router.get('/config', authController.config);
router.post('/login', loginIpLimiter, loginAccountLimiter, loginChallenge, authController.login);
router.post('/register', registerLimiter, registerChallenge, authController.register);
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

export default router;
