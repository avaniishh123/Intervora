import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import LiveSessionController from '../controllers/LiveSessionController';

const router = Router();

// Public routes (no auth needed — candidates join without accounts)
router.get('/:sessionId', (req: Request, res: Response) =>
  LiveSessionController.getSession(req as any, res, () => {})
);
router.post('/:sessionId/join', (req: Request, res: Response) =>
  LiveSessionController.joinSession(req as any, res, () => {})
);
router.post('/:sessionId/leave', (req: Request, res: Response) =>
  LiveSessionController.leaveSession(req as any, res, () => {})
);

// Protected routes (interviewer must be authenticated)
router.get('/', authMiddleware, (req: Request, res: Response) =>
  LiveSessionController.getMySessions(req as any, res, () => {})
);
router.post('/', authMiddleware, (req: Request, res: Response) =>
  LiveSessionController.createSession(req as any, res, () => {})
);
router.post('/:sessionId/start', authMiddleware, (req: Request, res: Response) =>
  LiveSessionController.startSession(req as any, res, () => {})
);
router.post('/:sessionId/end', authMiddleware, (req: Request, res: Response) =>
  LiveSessionController.endSession(req as any, res, () => {})
);
router.post('/:sessionId/report', authMiddleware, (req: Request, res: Response) =>
  LiveSessionController.submitReport(req as any, res, () => {})
);
router.post('/:sessionId/ai-suggest', authMiddleware, (req: Request, res: Response) =>
  LiveSessionController.aiSuggest(req as any, res, () => {})
);

// Tokenized invite system
router.post('/:sessionId/invite', authMiddleware, (req: Request, res: Response) =>
  LiveSessionController.sendInvite(req as any, res, () => {})
);
router.get('/:sessionId/validate-token', (req: Request, res: Response) =>
  LiveSessionController.validateToken(req as any, res, () => {})
);

export default router;
