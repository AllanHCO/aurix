import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanBlock } from '../middleware/checkPlanBlock';
import { getSlug, putSlug } from '../controllers/agendaConfig.controller';

const router = Router();
router.use(authenticate);
router.use(checkPlanBlock);
router.get('/slug', getSlug);
router.put('/slug', putSlug);

export default router;
