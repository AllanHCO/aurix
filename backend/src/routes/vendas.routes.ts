import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listarVendas,
  obterVenda,
  criarVenda
} from '../controllers/vendas.controller';

const router = Router();

router.use(authenticate);

router.get('/', listarVendas);
router.get('/:id', obterVenda);
router.post('/', criarVenda);

export default router;
