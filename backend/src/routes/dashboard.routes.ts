import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanBlock } from '../middleware/checkPlanBlock';
import { getDashboard, getDashboardSummary } from '../controllers/dashboard.controller';

const router = Router();
router.use(authenticate);
router.use(checkPlanBlock);
router.get('/', getDashboard);
router.get('/summary', getDashboardSummary);

export default router;
