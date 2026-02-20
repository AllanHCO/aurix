import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import 'express-async-errors';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { swaggerDocument } from './swagger';
import authRoutes from './routes/auth.routes';
import dashboardRoutes from './routes/dashboard.routes';
import produtosRoutes from './routes/produtos.routes';
import clientesRoutes from './routes/clientes.routes';
import vendasRoutes from './routes/vendas.routes';
import relatoriosRoutes from './routes/relatorios.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// OpenAPI JSON (para importar no Insomnia/Postman)
app.get('/api-docs.json', (req, res) => res.json(swaggerDocument));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/produtos', produtosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/vendas', vendasRoutes);
app.use('/api/relatorios', relatoriosRoutes);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 Swagger (APIs): http://localhost:${PORT}/api-docs`);
});
