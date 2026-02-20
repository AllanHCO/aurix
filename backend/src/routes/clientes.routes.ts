import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listarClientes,
  obterCliente,
  criarCliente,
  atualizarCliente,
  excluirCliente,
  obterHistoricoCompras
} from '../controllers/clientes.controller';

const router = Router();

router.use(authenticate);

router.get('/', listarClientes);
router.get('/:id', obterCliente);
router.get('/:id/historico', obterHistoricoCompras);
router.post('/', criarCliente);
router.put('/:id', atualizarCliente);
router.delete('/:id', excluirCliente);

export default router;
