import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import HybridRoomController from '../controllers/HybridRoomController';

const router = Router();

// Public — participants can poll, join, leave, and log events without auth
router.get('/:sessionId', (req: Request, res: Response) =>
  HybridRoomController.getRoom(req, res)
);
router.post('/:sessionId/join', (req: Request, res: Response) =>
  HybridRoomController.joinRoom(req, res)
);
router.post('/:sessionId/leave', (req: Request, res: Response) =>
  HybridRoomController.leaveRoom(req, res)
);
router.post('/:sessionId/log-event', (req: Request, res: Response) =>
  HybridRoomController.logEvent(req, res)
);

// Protected — only authenticated host can create / start / end / view log
router.post('/', authMiddleware, (req: Request, res: Response) =>
  HybridRoomController.createRoom(req as any, res)
);
router.post('/:sessionId/start', authMiddleware, (req: Request, res: Response) =>
  HybridRoomController.startRoom(req as any, res)
);
router.post('/:sessionId/end', authMiddleware, (req: Request, res: Response) =>
  HybridRoomController.endRoom(req as any, res)
);
router.get('/:sessionId/log', authMiddleware, (req: Request, res: Response) =>
  HybridRoomController.getLog(req as any, res)
);

export default router;
