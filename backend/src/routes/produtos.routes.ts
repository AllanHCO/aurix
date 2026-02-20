import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listarProdutos,
  obterProduto,
  criarProduto,
  atualizarProduto,
  excluirProduto
} from '../controllers/produtos.controller';

const router = Router();

router.use(authenticate);

router.get('/', listarProdutos);
router.get('/:id', obterProduto);
router.post('/', criarProduto);
router.put('/:id', atualizarProduto);
router.delete('/:id', excluirProduto);

export default router;
