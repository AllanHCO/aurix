import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { seedDemo } from '../controllers/seedDemo.controller';

const router = Router();
router.use(authenticate);
router.post('/seed-demo', seedDemo);

export default router;
