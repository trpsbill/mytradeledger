import { Router } from 'express';
import { tokenController } from '../controllers/tokenController';
import { requireSessionAuth } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimit';
import { blockDemo } from '../middleware/blockDemo';

const router = Router();

const createTokenLimiter = authRateLimit('create-token', {
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many token creation requests, please try again later' },
});

router.get('/', requireSessionAuth, tokenController.list);
router.post('/', requireSessionAuth, blockDemo, createTokenLimiter, tokenController.create);
router.delete('/:id', requireSessionAuth, tokenController.revoke);

export default router;
