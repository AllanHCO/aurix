import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanBlock } from '../middleware/checkPlanBlock';
import {
  listarVendas,
  obterVenda,
  criarVenda,
  atualizarVenda,
  excluirVenda,
  marcarComoFechada,
  faturarLote,
  converterOrcamentoEmVenda,
  cancelarOrcamento,
  converterOsEmVenda,
  cancelarOs,
  listarAnexosVenda,
  uploadAnexoVenda,
  deletarAnexoVenda,
  downloadAnexoVenda
} from '../controllers/vendas.controller';
import { gerarOsPdf } from '../controllers/os-pdf.controller';
import { multerVendaAnexo } from '../middleware/uploadVendaAnexo';

const router = Router();
router.use(authenticate);
router.use(checkPlanBlock);

router.get('/', listarVendas);
router.post('/', criarVenda);
router.post('/faturar-lote', faturarLote);
router.delete('/:id', excluirVenda);
router.patch('/:id/fechar', marcarComoFechada);
router.patch('/:id/converter-em-venda', converterOrcamentoEmVenda);
router.patch('/:id/cancelar-orcamento', cancelarOrcamento);
router.patch('/:id/converter-os-em-venda', converterOsEmVenda);
router.patch('/:id/cancelar-os', cancelarOs);
router.get('/:id/os-pdf', gerarOsPdf);
router.get('/:id/anexos', listarAnexosVenda);
router.post('/:id/anexos', multerVendaAnexo, uploadAnexoVenda);
router.delete('/:id/anexos/:anexoId', deletarAnexoVenda);
router.get('/:id/anexos/:anexoId/download', downloadAnexoVenda);
router.get('/:id', obterVenda);
router.put('/:id', atualizarVenda);

export default router;
