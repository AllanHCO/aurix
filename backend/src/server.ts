/**
 * Ordem crítica: carregar env e validar ambiente ANTES de qualquer uso de process.env.
 * Localhost NUNCA pode usar banco/auth/storage de produção.
 */
import './config/loadEnv';
import { validateEnvAndBlockIfUnsafe, getEnvSummary } from './config/env';

validateEnvAndBlockIfUnsafe();

import express from 'express';
import path from 'path';
import fs from 'fs';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import 'express-async-errors';
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
import businessAreasRoutes from './routes/businessAreas.routes';
import empresasRoutes from './routes/empresas.routes';
import financeiroRoutes from './routes/financeiro.routes';
import fornecedoresRoutes from './routes/fornecedores.routes';
import devRoutes from './routes/dev.routes';

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

// Em produção, servir frontend estático (Fly/Render tudo-em-um)
const publicPath = path.join(__dirname, 'public');
if (process.env.NODE_ENV === 'production' && fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicPath, 'index.html'));
  });
} else {
  // Raiz (dev ou sem pasta public)
  app.get('/', (req, res) => {
    res.json({
      service: 'aurix-backend',
      status: 'ok',
      health: '/health',
      docs: '/api-docs',
      timestamp: new Date().toISOString()
    });
  });
}

// Health check (Render e monitoramento)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Identificação do ambiente (sem credenciais) — para conferência rápida e frontend (badge)
app.get('/health/env', (req, res) => {
  const summary = getEnvSummary();
  res.json({
    APP_ENV: summary.APP_ENV,
    DATABASE: summary.DATABASE,
    STORAGE: summary.STORAGE,
    PORT: summary.PORT,
    timestamp: new Date().toISOString()
  });
});
app.get('/api/health/env', (req, res) => {
  const summary = getEnvSummary();
  res.json({
    APP_ENV: summary.APP_ENV,
    DATABASE: summary.DATABASE,
    STORAGE: summary.STORAGE,
    PORT: summary.PORT,
    timestamp: new Date().toISOString()
  });
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
      hint:
        'Confira DATABASE_URL no Fly/Render (Transaction pooling 6543, sem aspas no secret). O servidor injeta sslmode, pgbouncer e connection_limit. Comando: fly secrets list'
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
app.use('/api/configuracoes/business-areas', businessAreasRoutes);
app.use('/api/configuracoes/agendamento', configuracoesAgendamentoRoutes);
app.use('/api/empresas', empresasRoutes);
app.use('/api/financeiro', financeiroRoutes);
app.use('/api/fornecedores', fornecedoresRoutes);
app.use('/api/dev', devRoutes);
app.use('/api/public/agenda', agendaPublicRoutes);

// Error handler
app.use(errorHandler);

app.listen(Number(PORT), '0.0.0.0', () => {
  const summary = getEnvSummary();
  console.log('');
  console.log('════════════════════════════════════════════════');
  console.log(`  APP_ENV=${summary.APP_ENV}`);
  console.log(`  DATABASE=${summary.DATABASE}`);
  console.log(`  STORAGE=${summary.STORAGE}`);
  console.log(`  PORT=${summary.PORT}`);
  console.log('════════════════════════════════════════════════');
  console.log(`🚀 Server: http://0.0.0.0:${PORT}`);
  console.log(`📚 Swagger: http://localhost:${PORT}/api-docs`);
  console.log('');
});
