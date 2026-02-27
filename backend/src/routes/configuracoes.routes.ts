import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanBlock } from '../middleware/checkPlanBlock';
import { getConfiguracoes, putConfiguracoes, getConfiguracoesMensagens } from '../controllers/configuracoes.controller';
import { getDemoStatusHandler, postDemoGerar, postDemoResetar } from '../controllers/demo.controller';

const router = Router();
router.use(authenticate);
router.use(checkPlanBlock);
router.get('/', getConfiguracoes);
router.get('/mensagens', getConfiguracoesMensagens);
router.put('/', putConfiguracoes);

// Modo Demo (Sistema)
router.get('/demo/status', getDemoStatusHandler);
router.post('/demo/gerar', postDemoGerar);
router.post('/demo/resetar', postDemoResetar);

export default router;
