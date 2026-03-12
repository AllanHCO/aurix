# Isolamento multi-tenant (por conta/empresa)

## Regra principal

**Cada dado de negócio pertence a uma única conta (usuário).**  
Neste sistema, **1 usuário = 1 empresa** (tenant). Todo CRUD deve filtrar/criar por `usuario_id`.

## Modelo

- **Usuario** = conta/empresa (login).
- **organization_id** = `usuario_id` (não há tabela Organization separada).
- **BusinessArea** = subdivisão opcional dentro da mesma conta (ex.: Mecânica, Funilaria).

## Tabelas com tenant (`usuario_id`)

Todas as entidades principais possuem `usuario_id` e são filtradas por ele:

- **Categoria** — `usuario_id` (obrigatório)
- **Cliente** — `usuario_id` (obrigatório)
- **Produto** — `usuario_id` (obrigatório)
- **Venda** — já tinha `usuario_id`
- **Agendamento**, **Bloqueio**, **FinancialCategory**, **FinancialTransaction**, **Supplier**, **SupplierCategory**, **BusinessArea**, **ProductPurchaseHistory**, **InventoryMovement** — já tinham `usuario_id`

## Helpers (`backend/src/lib/tenant.ts`)

- **getCurrentOrganizationId(req)** — retorna `req.userId` (obrigatório em rotas autenticadas).
- **organizationFilter(organizationId)** — retorna `{ usuario_id: organizationId }` para usar em `where`.
- **assertRecordOwnership(record, organizationId, getOwnerId, label)** — garante que o registro pertence à organização; caso contrário lança `AppError` 404 e opcionalmente loga tentativa de acesso cross-tenant.

## Regras no backend

1. **CREATE** — Sempre definir `usuario_id` a partir do usuário autenticado (`getCurrentOrganizationId(req)`). Nunca confiar no frontend.
2. **READ** — Todas as listagens e buscas devem incluir `usuario_id` no `where` (ou JOIN que restrinja por usuário).
3. **UPDATE / DELETE** — Antes de alterar ou excluir, garantir que o registro pertence ao usuário (ex.: `findFirst({ where: { id, usuario_id } })` ou `assertRecordOwnership`).

## Migração de dados existentes

O script `backend/prisma/migrations_add_tenant_usuario_id.sql`:

- Adiciona `usuario_id` em **categorias**, **clientes** e **produtos**.
- Faz backfill: categorias e produtos a partir do primeiro usuário; clientes a partir da primeira venda do cliente (ou primeiro usuário).
- Cria índices e constraints (unique por usuário onde aplicável).

**Ordem:** executar o SQL no banco **antes** de subir a nova versão do backend.

## Logs de segurança

Com `LOG_TENANT_ACCESS=true` (ou em desenvolvimento), o tenant loga:

- Tentativa de acesso a registro de outra organização.
- Registro sem `usuario_id` (legado).

## Testes manuais sugeridos

1. **Conta A vs B** — Criar cliente/produto/venda na conta A; fazer login na conta B e verificar que nenhum dado da conta A aparece.
2. **ID na URL** — Editar manualmente o ID de um recurso na URL (ex.: outro cliente); o backend deve retornar 404 se o registro for de outra conta.
3. **Ambiente** — Garantir que localhost usa apenas banco/auth de desenvolvimento (ver `docs/ENV.md`).
