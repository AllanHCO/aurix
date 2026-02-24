import { PrismaClient } from '@prisma/client';
import { addDbSample } from './perfContext';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : [],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Medição de performance de queries Prisma (tempo em ms por operação).
prisma.$use(async (params, next) => {
  const start = process.hrtime.bigint();
  const result = await next(params);
  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1_000_000;

  // Acumula tempo em um contexto por-request (para logs de /dashboard/summary, etc.)
  addDbSample(durationMs);

  if (process.env.NODE_ENV === 'development' && durationMs > 100) {
    const model = params.model ?? 'raw';
    console.log(
      `[DB] ${model}.${params.action} - ${durationMs.toFixed(1)}ms`,
    );
  }

  return result;
});
