import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanBlock } from '../middleware/checkPlanBlock';
import {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  excluirCategoria
} from '../controllers/categorias.controller';

const router = Router();
router.use(authenticate);
router.use(checkPlanBlock);
router.get('/', listarCategorias);
router.post('/', criarCategoria);
router.put('/:id', atualizarCategoria);
router.delete('/:id', excluirCategoria);

export default router;
