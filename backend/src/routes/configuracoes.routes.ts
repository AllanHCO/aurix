import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanBlock } from '../middleware/checkPlanBlock';
import { getConfiguracoes, putConfiguracoes, getConfiguracoesMensagens } from '../controllers/configuracoes.controller';

const router = Router();
router.use(authenticate);
router.use(checkPlanBlock);
router.get('/', getConfiguracoes);
router.get('/mensagens', getConfiguracoesMensagens);
router.put('/', putConfiguracoes);

export default router;
