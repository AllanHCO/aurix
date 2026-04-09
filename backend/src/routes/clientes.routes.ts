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
  getModeloImportacao,
  getRetencao
} from '../controllers/clientes.controller';
import {
  listarExtraItems,
  criarExtraItem,
  atualizarExtraItem,
  excluirExtraItem
} from '../controllers/clientesExtraItems.controller';
import {
  getClienteFicha,
  putClienteFicha,
  postClienteFichaImagem,
  deleteClienteFichaImagem,
  getClienteFichaImagemFile
} from '../controllers/clientesFicha.controller';
import { multerClienteFichaImagem } from '../middleware/uploadClienteFichaImagem';

const router = Router();
router.use(authenticate);
router.use(checkPlanBlock);
router.get('/retencao', getRetencao);
router.get('/', listarClientes);
router.get('/import/modelo', getModeloImportacao);
router.post('/import', importarClientes);
router.get('/:id/extra-items', listarExtraItems);
router.post('/:id/extra-items', criarExtraItem);
router.put('/:id/extra-items/:itemId', atualizarExtraItem);
router.delete('/:id/extra-items/:itemId', excluirExtraItem);
router.get('/:id/ficha/imagens/:imageId/file', getClienteFichaImagemFile);
router.post('/:id/ficha/imagens', multerClienteFichaImagem, postClienteFichaImagem);
router.delete('/:id/ficha/imagens/:imageId', deleteClienteFichaImagem);
router.get('/:id/ficha', getClienteFicha);
router.put('/:id/ficha', putClienteFicha);
router.get('/:id/historico', obterHistoricoCompras);
router.get('/:id', obterCliente);
router.post('/', criarCliente);
router.put('/:id', atualizarCliente);
router.delete('/:id', excluirCliente);

export default router;
