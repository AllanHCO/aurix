import { Router } from 'express';
import * as ctrl from '../controllers/agendaPublic.controller';

const router = Router();

router.get('/:empresaSlug/branding', ctrl.getBranding);
router.get('/:empresaSlug/public-config', ctrl.getPublicConfig);
router.get('/:empresaSlug/info', ctrl.getAgendaInfo);
router.get('/:empresaSlug/dias-disponiveis', ctrl.getDias);
router.get('/:empresaSlug/mes', ctrl.getMes);
router.get('/:empresaSlug/horarios', ctrl.getHorarios);
router.post('/:empresaSlug/agendamentos', ctrl.createAgendamento);

export default router;
