import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanBlock } from '../middleware/checkPlanBlock';
import * as ctrl from '../controllers/agendamentos.controller';

const router = Router();
router.use(authenticate);
router.use(checkPlanBlock);

router.get('/', ctrl.listByMonth);
router.get('/dia', ctrl.listByDay);
router.get('/horarios-disponiveis', ctrl.getHorariosDisponiveisInternal);
router.get('/proximos', ctrl.listProximos);
router.get('/pendentes', ctrl.listPendentes);
router.get('/resumo', ctrl.getResumo);
router.post('/', ctrl.createManual);
router.patch('/:id/status', ctrl.updateStatus);

export default router;
