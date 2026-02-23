import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getSlug, putSlug } from '../controllers/agendaConfig.controller';

const router = Router();
router.use(authenticate);

router.get('/slug', getSlug);
router.put('/slug', putSlug);

export default router;
