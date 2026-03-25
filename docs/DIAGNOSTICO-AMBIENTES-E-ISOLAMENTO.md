# Diagnóstico técnico: ambientes e isolamento entre contas

Análise do estado atual do projeto **sem implementar correções**. Objetivo: entender exatamente como está a separação de ambientes e o isolamento de dados entre contas.

---

## 1. Situação atual dos ambientes

### 1.1 Desenvolvimento (localhost)

| Aspecto | Situação atual |
|--------|-----------------|
| **Banco** | Definido por `DATABASE_URL` em `.env`, `.env.development` ou `.env.local`. **Proteção:** ao subir o backend, `validateEnvAndBlockIfUnsafe()` roda no `server.ts`. Se `APP_ENV` for development/staging e a URL **parecer de produção** (ex.: supabase.co, fly.io, postgresql remoto **sem** trecho `_dev`, `aurix_dev`, `staging`, `localhost`), o processo **encerra com erro** e não inicia. Ou seja: localhost **não** deve conseguir usar o mesmo banco de produção, a menos que a URL de produção seja forçada com um marcador de dev no path (ex.: `?schema=public&_dev=1`), o que a validação considera “não produção”. |
| **Auth** | JWT assinado com `JWT_SECRET` carregado do env local. Tokens são por ambiente: o secret de produção (Fly secrets) é diferente do de dev. **Usuários** vêm do banco: se o banco for separado, os logins são separados. |
| **Storage/anexos** | Backend usa `getUploadsBaseDir()`: em **não produção** retorna `uploads_development` (ou `uploads_staging`). Arquivos ficam em disco local (`process.cwd()/uploads_development/vendas/...`). **Não há** S3/Supabase Storage; não há compartilhamento com produção. |
| **Variáveis** | Ordem de carga em `loadEnv.ts`: `.env` → `.env.development` (se NODE_ENV ≠ production) ou `.env.staging` → `.env.local`. **`.env.production` só é carregado se NODE_ENV=production** (típico do host de produção). Em máquina local, não carregar `.env.production` evita sobrescrever acidentalmente com credenciais de prod. |
| **URLs** | Backend: `PORT` (ex.: 3001). Frontend: `VITE_API_URL` ou fallback `/api` (proxy). Em dev, se `VITE_API_URL` for remoto, o `api.ts` do frontend emite **aviso no console** para não apontar para produção. |

**Risco residual:** Se alguém colocar em `.env.local` uma `DATABASE_URL` de produção **sem** nenhum marcador `_dev`/`aurix_dev`/`staging`/`localhost`, a validação bloqueia e o servidor não sobe. O único jeito de “enganar” seria usar uma URL de prod que contenha, por exemplo, `_dev` em algum lugar.

---

### 1.2 Homologação (staging)

| Aspecto | Situação atual |
|--------|-----------------|
| **Existência** | O **código** suporta `APP_ENV=staging` e `NODE_ENV=staging`: há `isStaging`, `.env.staging.example`, e storage `uploads_staging`. **Não há** no repositório evidência de um deploy dedicado de homologação (ex.: app Fly “aurix-staging”). Ou seja: homologação existe como **conceito e configuração**, mas pode não estar implantada como ambiente separado. |
| **Banco** | Se existir deploy staging, deve usar `DATABASE_URL` com banco próprio (ex.: `aurix_staging` ou projeto Supabase de staging). A mesma `validateEnvAndBlockIfUnsafe()` impede uso de URL “de produção” quando `APP_ENV=staging`. |
| **Auth / Storage** | Mesmo modelo que dev: JWT com secret do env de staging; uploads em `uploads_staging` no servidor onde roda. |

---

### 1.3 Produção

| Aspecto | Situação atual |
|--------|-----------------|
| **Banco** | Fly.io (e semelhantes): `DATABASE_URL` vem de **secrets** (ex.: Supabase produção). A validação exige que, em produção, a URL **não** contenha localhost nem marcadores `_dev`/`aurix_staging`/staging; caso contrário, o processo não inicia. |
| **Auth** | `JWT_SECRET` em produção (Fly secrets) com ≥ 32 caracteres; obrigatório na validação. Geração e validação de token são por esse secret. |
| **Storage** | `getUploadsBaseDir()` retorna **`uploads`** (pasta no filesystem do container/host de produção). Efêmero no Fly se não houver volume persistente; não há bucket externo compartilhado com dev. |
| **URLs** | `FRONTEND_URL` obrigatório em produção (validação). CORS e links usam essa URL. |

---

### Resumo dos ambientes

- **Localhost:** protegido por validação ao subir o backend; env carregado sem `.env.production`; storage e auth separados por configuração.
- **Homologação:** suportada no código; não há evidência de deploy próprio; se existir, deve usar banco e env próprios.
- **Produção:** regras de validação impedem uso de banco “de dev”; JWT e uploads são do ambiente de produção.

---

## 2. Situação atual do isolamento entre contas

### 2.1 Modelo em uso: **Modelo A (1 login = 1 empresa)**

- **Tenant key:** `usuario_id` (ID do usuário autenticado = “organização”).
- **Fonte:** `backend/src/lib/tenant.ts`: *“Neste sistema, tenant = usuário autenticado (1 usuário = 1 empresa/conta).”*
- **Não há** `organization_id` separado: não é “vários usuários na mesma empresa”; é “cada usuário é uma empresa”.

### 2.2 Como está funcionando hoje

- **Listagens:** Os controllers que foram auditados usam `req.userId` (ou `getCurrentOrganizationId(req)`) e incluem `usuario_id: userId` (ou `organizationFilter(userId)`) nas queries de produtos, clientes, vendas, fornecedores, transações financeiras, categorias, áreas de negócio, agendamentos, bloqueios, relatórios, etc.
- **Detalhe por ID:** Uso de `findFirst({ where: { id, usuario_id: userId } })` ou `organizationFilter` + `assertRecordOwnership` nos acessos por ID (produto, cliente, venda, fornecedor, transação, etc.).
- **Criação:** `usuario_id` é definido no backend a partir de `req.userId`, não aceito do frontend.
- **Update/Delete:** Verificação de ownership antes de atualizar ou excluir (ex.: cliente, produto, venda, fornecedor, transação).
- **Entidades filhas (sem `usuario_id` próprio):** Acesso indireto pelo pai que tem `usuario_id`:
  - **VendaAnexo / ItemVenda / ItemServicoOrdem:** acesso sempre via `Venda`; as rotas de anexos (listar, upload, deletar, download) checam antes `venda` com `usuario_id: userId`.
  - **ClientExtraItem:** acesso via `Cliente`; em todas as ações (listar, criar, atualizar, excluir) o controller valida o cliente com `organizationFilter(usuarioId)` antes.

### 2.3 Tabelas com `usuario_id` no schema (Prisma)

Presentes no schema com `usuario_id`: Usuario (como referência), BusinessArea, CompanySettings, DemoEntity, Categoria, Produto, Cliente, Venda, ConfiguracaoAgenda, DisponibilidadeSemanal, Agendamento, Bloqueio, FinancialCategory, FinancialTransaction, SupplierCategory, Supplier, ProductPurchaseHistory, InventoryMovement.

Sem `usuario_id` (e tratadas por pai): ClientExtraItem (via Cliente), VendaAnexo, ItemVenda, ItemServicoOrdem (via Venda).

### 2.4 Segurança do isolamento entre contas

- **Desenho:** Consistente com 1 login = 1 empresa e uso de `usuario_id` em listagens, detalhes, criação, atualização e exclusão.
- **Correção já feita:** Em `purchases.controller`, a busca de produtos para registrar compra foi corrigida para filtrar por `usuario_id`, evitando usar produto de outra conta.
- **Condição crítica:** O **banco** precisa ter a coluna `usuario_id` populada nas tabelas que o código usa (ex.: clientes, categorias, produtos, vendas). Se a migração de tenant não tiver sido aplicada em algum ambiente, as queries podem falhar ou, em cenários antigos, haver risco de dados sem filtro. **No estado atual do código**, assumindo banco já migrado, o isolamento entre contas está implementado.

---

## 3. Problemas encontrados (lista objetiva)

Nenhum problema **crítico** novo foi identificado na análise estática em relação a:

- localhost usando banco/auth/storage de produção (protegido por validação e carga de env);
- vazamento entre contas (controllers auditados filtram por `usuario_id` e validam ownership);
- acesso por ID sem ownership (rotas por ID verificam `usuario_id` ou pai com `usuario_id`).

Problemas **potenciais** ou de **configuração**:

| # | Problema | Risco | Onde |
|---|----------|--------|------|
| 1 | Homologação pode não existir como deploy real | Staging e produção podem ser o mesmo ambiente se não houver app/banco separados. | Deploy/infra (não no código). |
| 2 | `looksLikeProductionDatabaseUrl` considera qualquer `postgresql://` remoto sem marcador como “produção” | Um projeto Supabase **de dev** cuja URL não tenha `_dev`/`aurix_dev`/`staging` será bloqueado em local. | `backend/src/config/env.ts`. |
| 3 | Anexos em produção (Fly) em disco efêmero | Arquivos de anexo podem ser perdidos ao reiniciar/redimensionar máquina se não houver volume. | Infra/deploy. |
| 4 | Frontend em dev pode apontar para API de produção | Se alguém definir `VITE_API_URL` para a URL do Fly em `.env.local` do front, pode poluir dados reais. Só há aviso no console. | Configuração local; `frontend/src/services/api.ts` só avisa. |

---

## 4. Itens críticos (o que precisa ser corrigido primeiro)

Na análise atual **não há itens críticos de código** pendentes para:

- separação local vs produção (validação já bloqueia),
- isolamento entre contas (tenant por `usuario_id` e ownership já aplicados nos pontos auditados).

Itens que **podem** ser tratados como críticos dependendo do uso:

- **Garantir que a migração de tenant (`usuario_id`)** foi aplicada em **todos** os bancos usados (dev e prod). Sem isso, erros 500 ou comportamento incorreto são esperados.
- **Definir política para homologação:** se for usada, ter app e banco próprios e `APP_ENV=staging`/`NODE_ENV=staging` com `DATABASE_URL` e `JWT_SECRET` de staging.

---

## 5. Itens importantes, mas não críticos

- Ajustar mensagem ou critério de “URL de produção” se quiser usar um projeto Supabase de dev cuja URL não tenha `_dev` (ex.: aceitar um nome de projeto ou variável explícita tipo `SAFE_FOR_DEV=true`).
- Reforçar aviso no frontend quando `VITE_API_URL` em dev for remoto (ex.: modal ou bloqueio em dev).
- Planejar storage persistente para anexos em produção (volume ou bucket) se a perda de arquivos for inaceitável.
- Documentar no README ou em “deploy” a obrigatoriedade de rodar a migração de tenant antes do primeiro deploy com este código.

---

## 6. Recomendação técnica final

- **Ambientes:** Manter a validação atual no backend; garantir que cada ambiente (dev, staging, prod) use seu próprio `DATABASE_URL`, `JWT_SECRET` e, em prod, `FRONTEND_URL`. Se usar homologação, criar deploy e banco dedicados.
- **Isolamento entre contas:** Manter o modelo atual (1 login = 1 empresa, tenant = `usuario_id`). Não é necessário introduzir `organization_id` para o estágio atual; a tenant key é o próprio `usuario_id`.
- **Banco:** Garantir em todos os ambientes a migração que adiciona e preenche `usuario_id` nas tabelas de negócio (ex.: `migrations_add_tenant_usuario_id.sql` ou equivalente), com tipo compatível com `usuarios.id` (ex.: TEXT se for o caso).
- **Storage:** Avaliar persistência de anexos em produção (volume ou objeto); hoje é filesystem efêmero no Fly.
- **Próximos passos:** Rodar o seed de duas empresas e o script de testes de isolamento (`audit:seed`, `audit:test-isolation`) em ambiente de dev para validar na prática o isolamento e o acesso por ID; repetir em homologação se existir.

---

## 6. Testar se há vazamento entre contas

**Análise no código (sem rodar o sistema):**

- **Produto do login A no login B:** As listagens de produtos usam `usuario_id` (via `getCurrentOrganizationId` / raw SQL com `whereUsuarioId`). O detalhe por ID usa `findFirst({ where: { id, ...organizationFilter(userId) } })`. Se B chamar `GET /api/produtos/:idDeA`, o backend não encontra o registro (ownership) e retorna 404. **Risco de vazamento: não**, desde que o banco tenha `usuario_id` preenchido.
- **Cliente da conta A na conta B:** Mesmo padrão (filtro e ownership por `usuario_id`). **Risco: não**.
- **Venda da conta A na conta B:** Idem. **Risco: não**.
- **Anexo da conta A visível na conta B:** Listar/upload/delete/download de anexos validam a venda com `usuario_id: userId` antes de acessar o anexo. **Risco: não**.

**Teste real controlado:** O projeto já inclui `npm run audit:seed` (duas empresas com dados distintos) e `npm run audit:test-isolation` (script que, com o backend no ar, verifica que B não vê dados de A nas listagens e que B recebe 404 ao acessar por ID recursos de A). Executar esse script em ambiente de dev é a forma de **validar na prática** que não há vazamento.

---

## 7. Testar se há mistura entre local e produção

**Análise:**

- **Conta criada em localhost aparecer em produção:** Só ocorreria se localhost e produção usassem o **mesmo banco** e o **mesmo conjunto de usuários**. A validação ao subir o backend (`validateEnvAndBlockIfUnsafe`) **impede** que o backend suba em ambiente de desenvolvimento/staging quando a `DATABASE_URL` parece de produção (Supabase, Fly, etc., sem marcador `_dev`/`aurix_dev`/staging/localhost). Portanto, em configuração correta, local **não** usa o banco de produção. **Risco: não**, desde que não se force uma URL de prod sem marcador de dev no path.
- **Cliente/produto criado em local em produção:** Mesma condição: se os bancos forem separados (o que a validação busca garantir), não há mistura. **Risco: não**.
- **Anexos de local no storage de produção:** O storage é em disco local: produção usa a pasta `uploads` no servidor de produção; desenvolvimento usa `uploads_development` na máquina local. Não há bucket compartilhado. **Risco: não**.

**Conclusão:** Se a validação de ambiente estiver ativa (padrão ao subir o backend) e os arquivos de env estiverem corretos, **não** há mistura de dados entre local e produção. Qualquer cenário em que alguém ignore o bloqueio (ex.: comentar a validação ou usar URL de prod com marcador `_dev` de propósito) fica fora do desenho seguro e deve ser evitado.

---

## 8. Checklist de segurança (atendido ou não)

| Item | Situação |
|------|----------|
| Filtro por tenant em listagens | Sim, nos controllers auditados (produtos, clientes, vendas, fornecedores, financeiro, categorias, áreas, agendamentos, relatórios, etc.). |
| Validação de ownership em detalhe por ID | Sim (findFirst com `usuario_id` ou assertRecordOwnership). |
| Validação de ownership em update/delete | Sim. |
| Criação automática de tenant key no backend | Sim; `usuario_id` definido no backend a partir de `req.userId`. |
| Proteção contra localhost apontar para produção (banco) | Sim; `validateEnvAndBlockIfUnsafe()` ao subir o backend. |
| Separação de env (arquivos e carga) | Sim; `.env.production` só com NODE_ENV=production; `.env.local` para overrides locais. |
| Logs de ambiente | Sim; `getEnvSummary()` e rota `/health/env` (e semelhantes) com APP_ENV, hint de DB, storage, PORT. |
| Identificação visual do ambiente | Frontend tem `APP_ENV` e `ENV_LABEL` (Desenvolvimento / Homologação / Produção) para badge. |

---

## 9. Classificação dos problemas

- **CRÍTICO:** Nenhum identificado no código atual, desde que a migração de tenant esteja aplicada e os envs estejam corretos (dev não usar DATABASE_URL de prod sem marcador).
- **ALTO:** (1) Homologação não deployada como ambiente separado; (2) Anexos em produção em disco efêmero (se for requisito manter arquivos).
- **MÉDIO:** (1) Critério rígido de “URL de produção” pode bloquear alguns Supabase de dev; (2) Frontend em dev com `VITE_API_URL` de prod só avisa no console.
- **BAIXO:** Documentar obrigatoriedade da migração de tenant e política de envs no README/deploy.

---

## 10. Caminho mais simples e seguro

- **Mínimo agora:**  
  - Confirmar que em **produção** a migração de tenant foi aplicada e que `JWT_SECRET` e `FRONTEND_URL` estão nos secrets.  
  - Em **local**, usar `DATABASE_URL` com banco próprio e, se usar Supabase remoto de dev, incluir um marcador (ex.: `_dev`) na URL ou no projeto para não ser bloqueado.  
  - Rodar `npm run audit:seed` e `npm run audit:test-isolation` no backend (com banco de dev) para validar isolamento.

- **Ideal depois:**  
  - Ter um ambiente de homologação explícito (app + banco + envs).  
  - Persistir anexos de produção (volume ou bucket).  
  - Opcional: relaxar ou parametrizar a regra de “URL de produção” para projetos Supabase de dev com nome específico ou variável de “safe for dev”.

---

*Documento gerado a partir de auditoria estática do código (config, env, tenant, controllers e schema). Recomenda-se complementar com testes manuais e com o script de isolamento em ambiente de desenvolvimento.*
