import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { checkPlanBlock } from '../middleware/checkPlanBlock';
import { getConfiguracoes, putConfiguracoes, getConfiguracoesMensagens } from '../controllers/configuracoes.controller';
import { getDemoStatusHandler, postDemoGerar, postDemoResetar } from '../controllers/demo.controller';
import {
  getPersonalizacao,
  putPersonalizacao,
  postPersonalizacaoResetar,
  getPersonalizacaoPreset,
  getNichosNegocio,
  postOnboardingNicho
} from '../controllers/personalizacao.controller';
import {
  getPdfBranding,
  putPdfBranding,
  postPdfBrandingLogo,
  deletePdfBrandingLogo,
  getPdfBrandingLogoFile
} from '../controllers/document-branding.controller';
import { uploadBrandingLogoMemory } from '../middleware/uploadBrandingLogo';

const router = Router();
router.use(authenticate);
router.use(checkPlanBlock);
router.get('/', getConfiguracoes);
router.get('/mensagens', getConfiguracoesMensagens);
router.put('/', putConfiguracoes);

// Personalização do sistema
router.get('/personalizacao', getPersonalizacao);
router.put('/personalizacao', putPersonalizacao);
router.post('/personalizacao/resetar', postPersonalizacaoResetar);
router.get('/personalizacao/preset', getPersonalizacaoPreset);
router.post('/personalizacao/onboarding-nicho', postOnboardingNicho);
router.get('/nichos-negocio', getNichosNegocio);

// PDF / documentos — marca visual (OS; futuro pedido)
router.get('/documentos/pdf-branding', getPdfBranding);
router.put('/documentos/pdf-branding', putPdfBranding);
router.post(
  '/documentos/pdf-branding/logo',
  (req, res, next) => {
    uploadBrandingLogoMemory.single('file')(req, res, (err: unknown) => {
      if (err) return next(err);
      next();
    });
  },
  postPdfBrandingLogo
);
router.delete('/documentos/pdf-branding/logo', deletePdfBrandingLogo);
router.get('/documentos/pdf-branding/logo-file', getPdfBrandingLogoFile);

// Modo Demo (Sistema)
router.get('/demo/status', getDemoStatusHandler);
router.post('/demo/gerar', postDemoGerar);
router.post('/demo/resetar', postDemoResetar);

export default router;
