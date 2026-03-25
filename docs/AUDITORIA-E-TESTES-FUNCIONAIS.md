# Auditoria completa e testes funcionais

Objetivo: simular uso real, identificar bugs, vazamentos, erros de lógica e problemas de fluxo antes de colocar em produção.

---

## 1. Cenário de teste com duas empresas

### Criar automaticamente Empresa A e Empresa B

**Requisito:** banco de desenvolvimento (nunca produção).

```bash
cd backend
npm run audit:seed
```

Isso cria:

| Empresa  | Email                  | Senha     | Dados criados |
|----------|------------------------|-----------|----------------|
| Empresa A | empresa-a@audit.local | Audit@123 | Cliente A1, Filtro de óleo A, Troca de óleo (serviço), Venda A, Fornecedor A1, áreas Mecânica/Funilaria, transação financeira |
| Empresa B | empresa-b@audit.local | Audit@123 | Cliente B1, Pastilha B, Fornecedor B1, área Mecânica, transação financeira |

Use esses logins no frontend ou nas chamadas de API para testes manuais e automatizados.

---

## 2. Testes de isolamento (automatizados)

**Requisito:** backend rodando (`npm run dev`) e seed de auditoria já executado.

```bash
cd backend
npm run audit:test-isolation
```

O script:

- Faz login como Empresa A e Empresa B.
- Lista produtos, clientes, vendas, fornecedores e transações financeiras da Empresa A (guarda IDs).
- Lista os mesmos recursos como Empresa B e **verifica que nenhum ID da A aparece**.
- Como Empresa B, tenta **acesso direto por ID** a recursos da A (ex.: `GET /api/produtos/:idDaA`) e **espera 404**.

Se alguma verificação falhar, o script termina com código 1 e lista as falhas (possível vazamento ou endpoint inseguro).

---

## 3. Plano de testes manuais

### 3.1 Isolamento entre contas

- [ ] Login Empresa A → criar produto "Filtro de óleo A".
- [ ] Logout; login Empresa B.
- [ ] Confirmar: produto "Filtro de óleo A" **não** aparece em produtos, vendas, estoque nem relatórios.
- [ ] Repetir ideia para: clientes, vendas, OS, financeiro, fornecedores, categorias.

### 3.2 Acesso direto por ID

- [ ] Anotar um ID de produto/cliente/venda/fornecedor da Empresa A.
- [ ] Logado como Empresa B, abrir no navegador ou via API:
  - `/api/produtos/{id-da-A}`,
  - `/api/clientes/{id-da-A}`,
  - `/api/vendas/{id-da-A}`,
  - `/api/fornecedores/{id-da-A}`.
- [ ] Esperado: backend bloqueia (404 ou 403), sem expor dados da A.

### 3.3 Fluxo completo da oficina

1. Cadastrar cliente  
2. Cadastrar produto  
3. Cadastrar serviço  
4. Criar orçamento  
5. Converter em ordem de serviço  
6. Finalizar serviço  
7. Converter em venda  
8. Marcar venda como paga  
9. Verificar financeiro (entrada gerada)  
10. Registrar compra de fornecedor  
11. Verificar estoque  

Validar que todos os passos concluem sem erro e que os dados aparecem corretamente nas telas seguintes.

### 3.4 Áreas de negócio

- [ ] Criar áreas "Mecânica" e "Funilaria".
- [ ] Cadastrar produtos/vendas com áreas diferentes.
- [ ] Filtrar por área e ver "visualizar todos"; confirmar consolidação correta.

### 3.5 Financeiro

- [ ] Entrada manual; saída manual.
- [ ] Venda paga gerando entrada; compra gerando saída.
- [ ] Conferir: lucro / totais = entradas - saídas; filtros por data e por área.

### 3.6 Estoque

- [ ] Produto com estoque; venda diminuindo estoque; compra aumentando.
- [ ] Garantir que estoque não fica negativo.
- [ ] Histórico de compras e vínculo com fornecedores.

### 3.7 Anexos

- [ ] Upload de PDF e imagem em pedido/OS.
- [ ] Confirmar salvamento e que anexos não aparecem para outra empresa.

### 3.8 Interface

- [ ] Selects pesquisáveis, modais responsivos, tabelas com ações, filtros, paginação.
- [ ] Anotar telas quebradas, sobreposição de elementos, botões que não funcionam.

### 3.9 Ambiente

- [ ] Em máquina local: confirmar que **localhost não usa banco de produção** (APP_ENV, DATABASE_URL, SUPABASE_URL conforme documentação de deploy).

### 3.10 Performance básica

- [ ] Com muitos dados (ex.: 100 clientes, 200 produtos, 300 vendas), testar carregamento, paginação e filtros; confirmar que o sistema continua utilizável.

---

## 4. Relatório final (template)

Preencher após rodar testes automatizados e manuais.

### Bugs encontrados

| # | Módulo | Descrição | Severidade |
|---|--------|-----------|------------|
| 1 |       |           | CRÍTICO / ALTO / MÉDIO / BAIXO |

### Vazamentos de dados

| # | Descrição | Como reproduzir |
|---|-----------|-----------------|
| 1 |           |                 |

### Fluxos quebrados

| Etapa | O que falhou |
|-------|----------------|
|       |               |

### Problemas de UI

| Tela / componente | Inconsistência |
|-------------------|----------------|
|                   |                |

### Riscos de segurança

| Endpoint / ação | Problema |
|-----------------|----------|
|                 |          |

---

## 5. Classificação de problemas

- **CRÍTICO:** vazamento entre contas, erro que afeta valores financeiros, falha de autenticação. Corrigir antes de piloto.
- **ALTO:** fluxo principal quebrado, dados incorretos em relatórios. Corrigir em seguida.
- **MÉDIO:** funcionalidade secundária quebrada, UX ruim. Planejar correção.
- **BAIXO:** melhoria, texto, layout menor. Backlog.

---

## 6. Sugestão de correção (por bug)

Para cada bug no relatório, preencher:

- **Causa provável:** (ex.: falta de filtro por `usuario_id` em listagem)
- **Arquivo afetado:** (ex.: `backend/src/controllers/xxx.controller.ts`)
- **Possível solução:** (ex.: adicionar `usuario_id: userId` no `where` da query)

---

## 7. Resultado esperado

Após executar a auditoria e os testes:

- Isolamento entre contas garantido (e validado pelo script + testes manuais).
- Fluxo de negócio funcionando ponta a ponta.
- Nenhum erro **crítico** em aberto.
- Sistema em condições de piloto com clientes reais.

---

## 8. Roadmap de estabilização (exemplo)

Depois da auditoria, priorizar:

1. Itens **CRÍTICOS** (vazamento, auth, financeiro).
2. Itens **ALTOS** (fluxo oficina, relatórios).
3. Itens **MÉDIOS** por impacto no uso diário.
4. Itens **BAIXOS** no backlog.

Usar a tabela "Bugs encontrados" e a "Sugestão de correção" como base do roadmap de correções.

---

## 9. Auditoria de segurança (resumo de código)

Os controllers principais usam `usuario_id` (organização = usuário logado) para:

- **Listagens:** `where: { usuario_id: userId, ... }` em produtos, clientes, vendas, fornecedores, transações financeiras, categorias, áreas de negócio, agendamentos, etc.
- **Detalhe por ID:** `findFirst({ where: { id, usuario_id: userId } })` ou `organizationFilter(userId)` + `assertRecordOwnership`.
- **Create:** `usuario_id: userId` definido no backend, nunca vindo do frontend.
- **Update/Delete:** validação de ownership antes de alterar/excluir.

Helpers centralizados em `backend/src/lib/tenant.ts`: `getCurrentOrganizationId`, `organizationFilter`, `assertRecordOwnership`.

Correção já aplicada: em **compras** (`purchases.controller`), a busca de produtos para registrar compra passou a filtrar por `usuario_id`, evitando uso de produto de outra empresa.

Recomendação: após qualquer nova rota ou entidade, rodar `npm run audit:test-isolation` e incluir o recurso nos testes de isolamento e acesso por ID.
