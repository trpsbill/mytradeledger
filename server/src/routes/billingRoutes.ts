import { Router } from 'express';
import { billingController } from '../controllers/billingController';
import { blockDemo } from '../middleware/blockDemo';

const router = Router();

router.get('/status', billingController.getStatus);
router.post('/checkout-session', blockDemo, billingController.createCheckoutSession);
router.post('/cancel', blockDemo, billingController.cancelSubscription);
router.post('/portal-session', blockDemo, billingController.createPortalSession);

export default router;
