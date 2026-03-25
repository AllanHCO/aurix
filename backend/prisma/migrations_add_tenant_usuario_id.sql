



-- Multi-tenant: adicionar usuario_id em vendas, categorias, clientes e produtos.
-- Garante isolamento por conta (1 usuário = 1 empresa).
-- Executar após backup. Ajuste o backfill se necessário (ex.: ambiente sem usuários).

ALTER TABLE vendas ADD COLUMN IF NOT EXISTS usuario_id TEXT;
UPDATE vendas SET usuario_id = (SELECT id FROM usuarios LIMIT 1) WHERE usuario_id IS NULL;
ALTER TABLE vendas ALTER COLUMN usuario_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS vendas_usuario_id_idx ON vendas(usuario_id);

ALTER TABLE categorias ADD COLUMN IF NOT EXISTS usuario_id TEXT;
-- Backfill: atribuir ao primeiro usuário (ajuste se precisar de outra regra)
UPDATE categorias SET usuario_id = (SELECT id FROM usuarios LIMIT 1) WHERE usuario_id IS NULL;
ALTER TABLE categorias ALTER COLUMN usuario_id SET NOT NULL;
DROP INDEX IF EXISTS categorias_nome_tipo_key;
CREATE UNIQUE INDEX IF NOT EXISTS categorias_usuario_id_nome_tipo_key ON categorias(usuario_id, nome, tipo);
CREATE INDEX IF NOT EXISTS categorias_usuario_id_idx ON categorias(usuario_id);

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS usuario_id TEXT;
-- Backfill: por venda (cliente_id -> usuario_id da primeira venda); senão primeiro usuário
UPDATE clientes c
SET usuario_id = COALESCE(
  (SELECT v.usuario_id FROM vendas v WHERE v.cliente_id = c.id LIMIT 1),
  (SELECT id FROM usuarios LIMIT 1)
)
WHERE c.usuario_id IS NULL;
ALTER TABLE clientes ALTER COLUMN usuario_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS clientes_usuario_id_idx ON clientes(usuario_id);

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS usuario_id TEXT;
-- Backfill: por categoria (produto.categoria_id -> categoria.usuario_id); senão primeiro usuário
UPDATE produtos p
SET usuario_id = COALESCE(
  (SELECT c.usuario_id FROM categorias c WHERE c.id = p.categoria_id LIMIT 1),
  (SELECT id FROM usuarios LIMIT 1)
)
WHERE p.usuario_id IS NULL;
ALTER TABLE produtos ALTER COLUMN usuario_id SET NOT NULL;
DROP INDEX IF EXISTS produtos_nome_categoria_id_item_type_key;
CREATE UNIQUE INDEX IF NOT EXISTS produtos_usuario_id_nome_categoria_id_item_type_key ON produtos(usuario_id, nome, categoria_id, item_type);
CREATE INDEX IF NOT EXISTS produtos_usuario_id_idx ON produtos(usuario_id);
