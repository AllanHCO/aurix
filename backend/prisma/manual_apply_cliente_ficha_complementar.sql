-- Uso: só se as tabelas ainda não existirem e você não puder rodar `npx prisma migrate deploy`.
-- Conferência: deve coincidir com prisma/migrations/20260408120000_cliente_ficha_complementar/migration.sql

CREATE TABLE "cliente_ficha_complementar" (
    "cliente_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "observacoes_gerais" TEXT,
    "preferencias" TEXT,
    "informacoes_adicionais" JSONB,
    "atualizado_por_usuario_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cliente_ficha_complementar_pkey" PRIMARY KEY ("cliente_id")
);

CREATE TABLE "cliente_ficha_imagens" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "arquivo_path" VARCHAR(512) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_ficha_imagens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cliente_ficha_complementar_usuario_id_idx" ON "cliente_ficha_complementar"("usuario_id");
CREATE INDEX "cliente_ficha_imagens_cliente_id_idx" ON "cliente_ficha_imagens"("cliente_id");
CREATE INDEX "cliente_ficha_imagens_usuario_id_idx" ON "cliente_ficha_imagens"("usuario_id");

ALTER TABLE "cliente_ficha_complementar" ADD CONSTRAINT "cliente_ficha_complementar_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cliente_ficha_complementar" ADD CONSTRAINT "cliente_ficha_complementar_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cliente_ficha_complementar" ADD CONSTRAINT "cliente_ficha_complementar_atualizado_por_usuario_id_fkey" FOREIGN KEY ("atualizado_por_usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cliente_ficha_imagens" ADD CONSTRAINT "cliente_ficha_imagens_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cliente_ficha_imagens" ADD CONSTRAINT "cliente_ficha_imagens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
