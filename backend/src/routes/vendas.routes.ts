import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanBlock } from '../middleware/checkPlanBlock';
import {
  listarVendas,
  obterVenda,
  criarVenda,
  atualizarVenda,
  marcarComoFechada
} from '../controllers/vendas.controller';

const router = Router();
router.use(authenticate);
router.use(checkPlanBlock);

router.get('/', listarVendas);
router.post('/', criarVenda);
router.patch('/:id/fechar', marcarComoFechada);
router.get('/:id', obterVenda);
router.put('/:id', atualizarVenda);

export default router;
