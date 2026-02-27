import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanBlock } from '../middleware/checkPlanBlock';
import {
  listarClientes,
  obterCliente,
  criarCliente,
  atualizarCliente,
  excluirCliente,
  obterHistoricoCompras,
  importarClientes,
  getRetencao
} from '../controllers/clientes.controller';

const router = Router();
router.use(authenticate);
router.use(checkPlanBlock);
router.get('/retencao', getRetencao);
router.get('/', listarClientes);
router.post('/import', importarClientes);
router.get('/:id', obterCliente);
router.get('/:id/historico', obterHistoricoCompras);
router.post('/', criarCliente);
router.put('/:id', atualizarCliente);
router.delete('/:id', excluirCliente);

export default router;
