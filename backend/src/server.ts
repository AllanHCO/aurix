import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import 'express-async-errors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from './middleware/errorHandler';
import { swaggerDocument } from './swagger';
import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import produtosRoutes from './routes/produtos.routes';
import clientesRoutes from './routes/clientes.routes';
import vendasRoutes from './routes/vendas.routes';
import categoriasRoutes from './routes/categorias.routes';
import relatoriosRoutes from './routes/relatorios.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS: aceita FRONTEND_URL ou lista separada por vírgula (ex.: https://aurix-l3dn.onrender.com,http://localhost:5173)
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((o) => o.trim()).filter(Boolean)
  : ['http://localhost:5173'];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 Swagger (APIs): http://localhost:${PORT}/api-docs`);
});
