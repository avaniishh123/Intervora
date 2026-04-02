import { Router, Request, Response } from 'express';
import LiveSessionController from '../controllers/LiveSessionController';

const router = Router();

// Public — candidate views report via shareable link
router.get('/:reportId', (req: Request, res: Response) =>
  LiveSessionController.getReport(req as any, res, () => {})
);

export default router;
