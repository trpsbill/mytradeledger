import { Router } from 'express';
import multer from 'multer';
import { previewHandler } from '../import/preview';
import { commitHandler } from '../import/commit';
import { requirePaid } from '../middleware/requirePaid';
import { blockDemo } from '../middleware/blockDemo';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

router.post('/preview', blockDemo, upload.fields([{ name: 'file', maxCount: 1 }]), previewHandler);
router.post('/commit', blockDemo, requirePaid, upload.fields([{ name: 'file', maxCount: 1 }]), commitHandler);

export default router;
