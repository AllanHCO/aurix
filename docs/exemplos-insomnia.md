# Exemplos de requisições para o Insomnia

Use estes JSONs no **Body** das requisições. Em todas (exceto Login) use **Auth** → **Bearer Token** com o token do Login.

---

## POST /api/auth/login

**URL:** `http://localhost:3001/api/auth/login`  
**Auth:** Nenhuma

```json
{
  "email": "admin@aurix.com",
  "senha": "123456"
}
```

---

## POST /api/produtos

**URL:** `http://localhost:3001/api/produtos`  
**Auth:** Bearer Token

```json
{
  "nome": "Produto Exemplo",
  "preco": 99.90,
  "custo": 45.00,
  "estoque_atual": 50,
  "estoque_minimo": 10
}
```

---

## POST /api/clientes

**URL:** `http://localhost:3001/api/clientes`  
**Auth:** Bearer Token

```json
{
  "nome": "Maria Silva",
  "telefone": "(11) 99999-1234",
  "observacoes": "Cliente preferencial"
}
```

---

## PUT /api/produtos/:id

**URL:** `http://localhost:3001/api/produtos/:id` (troque `:id` pelo ID do produto)  
**Auth:** Bearer Token

```json
{
  "nome": "Produto Atualizado",
  "preco": 109.90,
  "custo": 50.00,
  "estoque_atual": 45,
  "estoque_minimo": 10
}
```

---

## PUT /api/clientes/:id

**URL:** `http://localhost:3001/api/clientes/:id` (troque `:id` pelo ID do cliente)  
**Auth:** Bearer Token

```json
{
  "nome": "Maria Silva Atualizada",
  "telefone": "(11) 98888-0000",
  "observacoes": "Cliente VIP"
}
```

---

## POST /api/vendas

**URL:** `http://localhost:3001/api/vendas`  
**Auth:** Bearer Token

Use os **id** reais de um cliente e de produtos (pegue com GET /api/clientes e GET /api/produtos).

```json
{
  "cliente_id": "cole-aqui-o-id-do-cliente",
  "itens": [
    {
      "produto_id": "cole-aqui-o-id-do-produto",
      "quantidade": 2,
      "preco_unitario": 99.90
    }
  ],
  "desconto": 10,
  "forma_pagamento": "Pix",
  "status": "PAGO"
}
```

---

## GET com query params

**Relatórios:**  
`GET http://localhost:3001/api/relatorios?dataInicial=2025-01-01&dataFinal=2025-12-31`

**Auth:** Bearer Token em todos os GET (exceto Login).
