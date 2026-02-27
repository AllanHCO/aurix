import express from 'express';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import 'express-async-errors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from './middleware/errorHandler';
import { perfLogger } from './middleware/perfLogger';
import { swaggerDocument } from './swagger';
import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import produtosRoutes from './routes/produtos.routes';
import clientesRoutes from './routes/clientes.routes';
import vendasRoutes from './routes/vendas.routes';
import categoriasRoutes from './routes/categorias.routes';
import relatoriosRoutes from './routes/relatorios.routes';
import agendaConfigRoutes from './routes/agendaConfig.routes';
import agendamentosRoutes from './routes/agendamentos.routes';
import bloqueiosRoutes from './routes/bloqueios.routes';
import agendaPublicRoutes from './routes/agendaPublic.routes';
import configuracoesAgendamentoRoutes from './routes/configuracoesAgendamento.routes';
import configuracoesRoutes from './routes/configuracoes.routes';
import empresasRoutes from './routes/empresas.routes';
import devRoutes from './routes/dev.routes';

dotenv.config();

// Render e outros Postgres externos exigem SSL; evita 500 ao acessar /api/vendas etc.
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('sslmode=')) {
  const sep = process.env.DATABASE_URL.includes('?') ? '&' : '?';
  process.env.DATABASE_URL = process.env.DATABASE_URL + sep + 'sslmode=require';
}

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: rotas públicas da agenda (/api/public/agenda) aceitam qualquer origem; demais rotas usam FRONTEND_URL
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((o) => o.trim()).filter(Boolean)
  : ['http://localhost:5173'];

app.use((req, res, next) => {
  const isPublicAgenda = req.path.startsWith('/api/public/agenda');
  const origin = req.headers.origin;
  const allowOrigin = isPublicAgenda
    ? (origin || '*')
    : !origin
      ? allowedOrigins[0]
      : allowedOrigins.includes(origin)
        ? origin
        : process.env.NODE_ENV === 'production'
          ? origin
          : null;
  if (allowOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(perfLogger);

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// OpenAPI JSON (para importar no Insomnia/Postman)
app.get('/api-docs.json', (req, res) => res.json(swaggerDocument));

// Raiz (para confirmar que a API está no ar)
app.get('/', (req, res) => {
  res.json({
    service: 'aurix-backend',
    status: 'ok',
    health: '/health',
    docs: '/api-docs',
    timestamp: new Date().toISOString()
  });
});

// Health check (Render e monitoramento)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Teste de conexão com o banco (para debug de 500 em login/register)
app.get('/health/db', async (req, res) => {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    await prisma.$disconnect();
    return res.json({ database: 'ok', timestamp: new Date().toISOString() });
  } catch (e: any) {
    await prisma.$disconnect().catch(() => {});
    return res.status(503).json({
      database: 'error',
      message: e?.message || String(e),
      hint: 'Adicione ?sslmode=require no final da DATABASE_URL no Render (Supabase).'
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/produtos', produtosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/vendas', vendasRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/relatorios', relatoriosRoutes);
app.use('/api/agenda', agendaConfigRoutes);
app.use('/api/agendamentos', agendamentosRoutes);
app.use('/api/bloqueios', bloqueiosRoutes);
app.use('/api/configuracoes', configuracoesRoutes);
app.use('/api/configuracoes/agendamento', configuracoesAgendamentoRoutes);
app.use('/api/empresas', empresasRoutes);
app.use('/api/dev', devRoutes);
app.use('/api/public/agenda', agendaPublicRoutes);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 Swagger (APIs): http://localhost:${PORT}/api-docs`);
});
