import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanBlock } from '../middleware/checkPlanBlock';
import {
  listar as listarSuppliers,
  obterPorId,
  criar as criarSupplier,
  atualizar as atualizarSupplier,
  excluir as excluirSupplier,
  analysis as analysisSuppliers,
  stats as statsSuppliers
} from '../controllers/suppliers.controller';
import {
  listar as listarCategories,
  criar as criarCategory,
  atualizar as atualizarCategory,
  excluir as excluirCategory
} from '../controllers/supplierCategories.controller';

const router = Router();
router.use(authenticate);
router.use(checkPlanBlock);

// Rotas estáticas antes de /:id para não interpretar "analysis" ou "categories" como id
router.get('/analysis', analysisSuppliers);
router.get('/stats', statsSuppliers);
router.get('/categories', listarCategories);
router.get('/', listarSuppliers);
router.get('/:id', obterPorId);
router.post('/', criarSupplier);
router.put('/:id', atualizarSupplier);
router.delete('/:id', excluirSupplier);
router.post('/categories', criarCategory);
router.put('/categories/:id', atualizarCategory);
router.delete('/categories/:id', excluirCategory);

export default router;
