import { Router } from 'express';
import { ledgerController } from '../controllers/ledgerController';
import { requirePaid } from '../middleware/requirePaid';

const router = Router();

// Ledger entries
router.get('/', ledgerController.getAll);
router.get('/export/csv', ledgerController.exportCsv);
router.post('/', requirePaid, ledgerController.create);
router.post('/batch', requirePaid, ledgerController.createBatch);
router.post('/recalculate-pnl', ledgerController.recalculatePnL);
router.delete('/all', ledgerController.deleteAll);
router.delete('/batch', ledgerController.deleteMany);
router.get('/:id', ledgerController.getById);
router.patch('/:id', ledgerController.update);
router.delete('/:id', ledgerController.delete);

// Metadata
router.get('/:id/metadata', ledgerController.getMetadata);
router.post('/:id/metadata', ledgerController.addMetadata);
router.delete('/:id/metadata/:metadataId', ledgerController.deleteMetadata);

export default router;