# Modo Demo

O Modo Demo preenche o sistema com dados realistas de 12 meses (clientes, produtos, vendas, agendamentos) para **testes e apresentações**.

## Como ativar/desativar

- **Ativar:** Em **Configurações > Sistema**, clique em **"Ativar Modo Demo / Gerar dados de 12 meses"**. O sistema gera clientes, categorias, produtos, vendas (12 meses), agendamentos e bloqueios, e marca a organização com `is_demo = true`.
- **Resetar:** No mesmo lugar, clique em **"Resetar dados demo"**. Todos os dados criados pelo demo são removidos e `is_demo` volta a `false`.

## Produção

Por segurança, as rotas de demo **não funcionam em produção** por padrão:

- `GET /api/configuracoes/demo/status`
- `POST /api/configuracoes/demo/gerar`
- `POST /api/configuracoes/demo/resetar`

Para permitir uso em produção (por exemplo, ambiente de homologação), defina:

```bash
ALLOW_DEMO=1
```

Ou `ALLOW_DEMO=true`. Sem essa variável, em `NODE_ENV=production` a API responde **403** para essas rotas.

## Banco de dados

- A coluna `company_settings.is_demo` indica se a organização está em modo demo.
- A tabela `demo_entities` guarda quais entidades (cliente, categoria, produto, venda, agendamento, bloqueio) foram criadas pelo demo, para poder apagar apenas elas no reset.

Execute as migrations (ou `npx prisma db push`) para criar `is_demo` e `demo_entities` se ainda não existirem.
