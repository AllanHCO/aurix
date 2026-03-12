import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanBlock } from '../middleware/checkPlanBlock';
import { list, create, update, remove } from '../controllers/businessAreas.controller';

const router = Router();
router.use(authenticate);
router.use(checkPlanBlock);

router.get('/', list);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

export default router;
