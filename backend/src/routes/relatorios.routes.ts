import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanBlock } from '../middleware/checkPlanBlock';
import { getRelatorioPeriodo, gerarRelatorio, exportarCSV } from '../controllers/relatorios.controller';

const router = Router();
router.use(authenticate);
router.use(checkPlanBlock);

router.get('/periodo', getRelatorioPeriodo);
router.get('/', gerarRelatorio);
router.get('/exportar', exportarCSV);

export default router;
