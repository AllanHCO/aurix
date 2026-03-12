-- Migração manual: Áreas de negócio
-- Use este arquivo apenas se prisma db push não for possível.
-- Recomendado: na pasta backend, rode: npx prisma db push

-- 1) Criar tabela business_areas
CREATE TABLE IF NOT EXISTS public.business_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  color VARCHAR(7),
  is_active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  UNIQUE(usuario_id, name)
);

CREATE INDEX IF NOT EXISTS idx_business_areas_usuario ON public.business_areas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_business_areas_usuario_active ON public.business_areas(usuario_id, is_active);

-- 2) Adicionar coluna business_area_id em vendas (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendas' AND column_name = 'business_area_id'
  ) THEN
    ALTER TABLE public.vendas
      ADD COLUMN business_area_id UUID REFERENCES public.business_areas(id) ON DELETE SET NULL;
    CREATE INDEX idx_vendas_business_area ON public.vendas(usuario_id, business_area_id);
  END IF;
END $$;

-- 3) Adicionar coluna business_area_id em financial_transactions (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_transactions' AND column_name = 'business_area_id'
  ) THEN
    ALTER TABLE public.financial_transactions
      ADD COLUMN business_area_id UUID REFERENCES public.business_areas(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_financial_transactions_business_area ON public.financial_transactions(usuario_id, business_area_id);
  END IF;
END $$;

-- 4) Adicionar coluna business_area_id em agendamentos (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'agendamentos' AND column_name = 'business_area_id'
  ) THEN
    ALTER TABLE public.agendamentos
      ADD COLUMN business_area_id UUID REFERENCES public.business_areas(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_agendamentos_business_area ON public.agendamentos(usuario_id, business_area_id);
  END IF;
END $$;

-- 5) Adicionar coluna business_area_id em produtos (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'produtos' AND column_name = 'business_area_id'
  ) THEN
    ALTER TABLE public.produtos
      ADD COLUMN business_area_id UUID REFERENCES public.business_areas(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_produtos_business_area ON public.produtos(business_area_id);
  END IF;
END $$;
