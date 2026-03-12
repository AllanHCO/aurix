-- =============================================================================
-- Corrigir divergência: histórico no banco usa nomes antigos das migrações.
-- Rode este SQL no Supabase (SQL Editor) UMA VEZ, depois rode: npx prisma migrate dev
-- =============================================================================

-- Atualizar o nome da migração "checkin/no_show" (era 2025, agora 20260227190000)
UPDATE "_prisma_migrations"
SET migration_name = '20260227190000_add_agendamento_checkin_no_show'
WHERE migration_name = '20250219140000_add_agendamento_checkin_no_show';

-- Atualizar o nome da migração "venda_agendamento_id" (era 20260219100000, agora 20260223130000)
UPDATE "_prisma_migrations"
SET migration_name = '20260223130000_venda_agendamento_id'
WHERE migration_name = '20260219100000_venda_agendamento_id';

-- Se alguma linha foi atualizada, o Prisma deixará de ver divergência.
-- Em seguida, no terminal: npx prisma migrate dev --name add_personalizacao_json
