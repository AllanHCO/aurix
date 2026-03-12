-- Remove o registro da migração que falhou (nome antigo) para desbloquear o deploy.
-- Execute este SQL no Supabase (SQL Editor) ou via: npx prisma db execute --file prisma/fix-failed-migration.sql
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20250219140000_add_agendamento_checkin_no_show';
