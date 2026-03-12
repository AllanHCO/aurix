-- Adiciona business_area_id em clientes e suppliers (filtro global por área de negócio).
-- Execute manualmente se prisma migrate dev falhar (ex.: shadow DB).

-- Clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS business_area_id UUID REFERENCES business_areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS clientes_business_area_id_idx ON clientes(business_area_id);

-- Fornecedores (suppliers)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS business_area_id UUID REFERENCES business_areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS suppliers_business_area_id_idx ON suppliers(business_area_id);
