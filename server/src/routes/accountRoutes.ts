import { Router } from 'express';
import { accountController } from '../controllers/accountController';
import { blockDemo } from '../middleware/blockDemo';

const router = Router();

router.get('/', accountController.getAll);
router.get('/:id', accountController.getById);
router.get('/:id/balance', accountController.getBalance);
router.get('/:id/pnl', accountController.getPnL);
router.post('/demo', accountController.seedDemo);
// Demo (anonymous) users are restricted to their single seeded Demo Portfolio
// account — creating additional accounts is blocked here.
router.post('/', blockDemo, accountController.create);
router.patch('/:id', accountController.update);
router.post('/:id/set-default', accountController.setDefault);
router.post('/:id/archive', accountController.archive);
router.post('/:id/unarchive', accountController.unarchive);
router.delete('/:id', accountController.delete);

export default router;