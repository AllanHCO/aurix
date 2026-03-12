# Sincronizar o banco SEM resetar (sem perder dados)

Quando aparecer a mensagem **"The migrations recorded in the database diverge from the local migrations directory"** e o Prisma sugerir reset, **não aceite** se você não quiser apagar os dados.

## Opção recomendada: `db push`

No terminal, na pasta `backend`:

```bash
npx prisma db push
```

Isso vai:

- Comparar o seu `schema.prisma` com o banco (Supabase)
- Aplicar **só o que falta**: novas colunas, tabelas, índices
- **Não apaga dados** e não usa o histórico de migrações

Depois rode:

```bash
npx prisma generate
```

Assim o cliente Prisma fica alinhado com o schema e a coluna `personalizacao_json` (e qualquer outra alteração) passa a existir no banco.

## Quando usar o quê

| Situação                         | Comando              |
|----------------------------------|----------------------|
| Ajustar o banco sem perder dados | `npx prisma db push` |
| Gerar cliente após mudar schema  | `npx prisma generate`|
| Resetar tudo (apaga dados)       | `npx prisma migrate reset` (só em dev) |

Depois de usar `db push`, o aviso de “migrations diverge” pode continuar aparecendo se você rodar `migrate dev` de novo, mas o banco e o app funcionam normalmente.
