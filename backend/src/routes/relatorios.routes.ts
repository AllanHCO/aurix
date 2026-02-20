import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { gerarRelatorio, exportarCSV } from '../controllers/relatorios.controller';

const router = Router();

router.use(authenticate);

router.get('/', gerarRelatorio);
router.get('/exportar', exportarCSV);

export default router;
