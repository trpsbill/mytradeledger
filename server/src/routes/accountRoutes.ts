import { Router } from 'express';
import { accountController } from '../controllers/accountController';

const router = Router();

router.get('/', accountController.getAll);
router.get('/:id', accountController.getById);
router.get('/:id/balance', accountController.getBalance);
router.get('/:id/pnl', accountController.getPnL);
router.post('/', accountController.create);
router.patch('/:id', accountController.update);
router.post('/:id/archive', accountController.archive);
router.post('/:id/unarchive', accountController.unarchive);
router.delete('/:id', accountController.delete);

export default router;
