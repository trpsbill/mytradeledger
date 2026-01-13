import { Router } from 'express';
import { assetController } from '../controllers/assetController';

const router = Router();

router.get('/', assetController.getAll);
router.get('/:id', assetController.getById);
router.post('/', assetController.create);
router.patch('/:id', assetController.update);
router.delete('/:id', assetController.delete);

export default router;
