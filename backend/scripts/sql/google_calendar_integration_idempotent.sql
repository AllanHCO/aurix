-- Idempotente: seguro rodar mais de uma vez no Postgres (produção / vários ambientes).
-- Google Calendar integration + colunas em agendamentos

CREATE TABLE IF NOT EXISTS "google_calendar_integrations" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "google_email" VARCHAR(320),
    "calendar_id" VARCHAR(256) NOT NULL DEFAULT 'primary',
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "token_expiry" TIMESTAMP(3),
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_calendar_integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "google_calendar_integrations_usuario_id_key"
  ON "google_calendar_integrations"("usuario_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'google_calendar_integrations_usuario_id_fkey'
  ) THEN
    ALTER TABLE "google_calendar_integrations"
      ADD CONSTRAINT "google_calendar_integrations_usuario_id_fkey"
      FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS "google_event_id" VARCHAR(256);
ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS "google_calendar_id" VARCHAR(256);
ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS "google_sync_status" VARCHAR(24);
ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS "google_last_sync_at" TIMESTAMP(3);
ALTER TABLE "agendamentos" ADD COLUMN IF NOT EXISTS "google_sync_error" VARCHAR(500);
