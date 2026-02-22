import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { listarCategorias, criarCategoria } from '../controllers/categorias.controller';

const router = Router();

router.use(authenticate);

router.get('/', listarCategorias);
router.post('/', criarCategoria);

export default router;
