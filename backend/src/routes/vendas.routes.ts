import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listarVendas,
  obterVenda,
  criarVenda,
  atualizarVenda
} from '../controllers/vendas.controller';

const router = Router();

router.use(authenticate);

router.get('/', listarVendas);
router.get('/:id', obterVenda);
router.post('/', criarVenda);
router.put('/:id', atualizarVenda);

export default router;
