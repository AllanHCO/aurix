/**
 * Script one-time: adiciona coluna business_area_id em clientes e suppliers
 * se ainda não existir. Rode: npx tsx scripts/add-business-area-columns.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const statements = [
    `ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "business_area_id" TEXT`,
    `CREATE INDEX IF NOT EXISTS "clientes_business_area_id_idx" ON "clientes"("business_area_id")`,
    `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "business_area_id" TEXT`,
    `CREATE INDEX IF NOT EXISTS "suppliers_business_area_id_idx" ON "suppliers"("business_area_id")`,
  ];
  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log('OK:', sql.slice(0, 60) + '...');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        console.log('Já existe:', sql.slice(0, 50) + '...');
      } else {
        throw e;
      }
    }
  }
  console.log('Colunas business_area_id verificadas/criadas.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
