import { Router } from 'express';
import multer from 'multer';
import { previewHandler } from '../import/preview';
import { commitHandler } from '../import/commit';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

router.post('/preview', upload.fields([{ name: 'file', maxCount: 1 }]), previewHandler);
router.post('/commit', upload.fields([{ name: 'file', maxCount: 1 }]), commitHandler);

export default router;
