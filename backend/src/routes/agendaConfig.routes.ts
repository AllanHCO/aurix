import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanBlock } from '../middleware/checkPlanBlock';
import * as ctrl from '../controllers/agendaConfig.controller';

const router = Router();
router.use(authenticate);
router.use(checkPlanBlock);
router.get('/config', ctrl.getConfig);
router.put('/config', ctrl.putConfig);
router.get('/slug', ctrl.getSlug);
router.put('/slug', ctrl.putSlug);
router.get('/branding', ctrl.getBranding);
router.put('/branding', ctrl.putBranding);

export default router;
