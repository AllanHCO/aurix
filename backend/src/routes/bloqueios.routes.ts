import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanBlock } from '../middleware/checkPlanBlock';
import * as ctrl from '../controllers/bloqueios.controller';

const router = Router();
router.use(authenticate);
router.use(checkPlanBlock);
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.delete('/:id', ctrl.remove);

export default router;
