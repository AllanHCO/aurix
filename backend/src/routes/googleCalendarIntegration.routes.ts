import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanBlock } from '../middleware/checkPlanBlock';
import * as ctrl from '../controllers/googleCalendarIntegration.controller';

const router = Router();

/** Callback OAuth (sem JWT — vem do Google) */
router.get('/callback', ctrl.oauthCallback);

router.use(authenticate);
router.use(checkPlanBlock);

router.get('/status', ctrl.getStatus);
router.get('/auth-url', ctrl.getAuthUrl);
router.post('/disconnect', ctrl.disconnect);
router.patch('/', ctrl.patchSettings);

export default router;
