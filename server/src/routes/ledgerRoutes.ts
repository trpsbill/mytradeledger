import { Router } from 'express';
import { ledgerController } from '../controllers/ledgerController';

const router = Router();

// Ledger entries
router.get('/', ledgerController.getAll);
router.get('/export/csv', ledgerController.exportCsv);
router.post('/', ledgerController.create);
router.post('/batch', ledgerController.createBatch);
router.post('/recalculate-pnl', ledgerController.recalculatePnL);
router.get('/:id', ledgerController.getById);
router.patch('/:id', ledgerController.update);
router.delete('/:id', ledgerController.delete);

// Metadata
router.get('/:id/metadata', ledgerController.getMetadata);
router.post('/:id/metadata', ledgerController.addMetadata);
router.delete('/:id/metadata/:metadataId', ledgerController.deleteMetadata);

export default router;
