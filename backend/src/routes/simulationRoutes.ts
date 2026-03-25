import { Router } from 'express';
import { simulationController } from '../controllers/SimulationController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.post('/start', (req, res, next) => simulationController.startSession(req, res, next));
router.get('/:id', (req, res, next) => simulationController.getSession(req, res, next));
router.post('/:id/event', (req, res, next) => simulationController.trackEvent(req, res, next));
router.post('/:id/run-code', (req, res, next) => simulationController.runCode(req, res, next));
router.post('/:id/submit', (req, res, next) => simulationController.submitTask(req, res, next));
router.post('/:id/complete', (req, res, next) => simulationController.completeSession(req, res, next));

export default router;
