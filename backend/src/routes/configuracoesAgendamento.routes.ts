import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as ctrl from '../controllers/configuracoesAgendamento.controller';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.getConfiguracoesAgendamento);
router.put('/', ctrl.putConfiguracoesAgendamento);

export default router;
