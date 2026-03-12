import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanBlock } from '../middleware/checkPlanBlock';
import {
  listarCategorias,
  criarCategoria,
  atualizarCategoria,
  excluirCategoria
} from '../controllers/financialCategories.controller';
import {
  listarTransacoes,
  criarTransacao,
  atualizarTransacao,
  excluirTransacao,
  overview,
  analysis
} from '../controllers/financialTransactions.controller';
import { registrarCompra } from '../controllers/purchases.controller';

const router = Router();
router.use(authenticate);
router.use(checkPlanBlock);

router.get('/overview', overview);
router.get('/analysis', analysis);
router.post('/purchases', registrarCompra);
router.get('/transactions', listarTransacoes);
router.post('/transactions', criarTransacao);
router.put('/transactions/:id', atualizarTransacao);
router.delete('/transactions/:id', excluirTransacao);
router.get('/categories', listarCategorias);
router.post('/categories', criarCategoria);
router.put('/categories/:id', atualizarCategoria);
router.delete('/categories/:id', excluirCategoria);

export default router;
