import { Router } from 'express';
import { accountController } from '../controllers/accountController';

const router = Router();

router.get('/', accountController.getAll);
router.get('/:id', accountController.getById);
router.get('/:id/balance', accountController.getBalance);
router.get('/:id/pnl', accountController.getPnL);
router.post('/demo', accountController.seedDemo);
router.post('/', accountController.create);
router.patch('/:id', accountController.update);
router.post('/:id/set-default', accountController.setDefault);
router.post('/:id/archive', accountController.archive);
router.post('/:id/unarchive', accountController.unarchive);
router.delete('/:id', accountController.delete);

export default router;