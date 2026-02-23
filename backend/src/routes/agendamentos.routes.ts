import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as ctrl from '../controllers/agendamentos.controller';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.listByMonth);
router.get('/dia', ctrl.listByDay);
router.get('/proximos', ctrl.listProximos);
router.get('/resumo', ctrl.getResumo);
router.post('/', ctrl.createManual);
router.patch('/:id/status', ctrl.updateStatus);

export default router;
