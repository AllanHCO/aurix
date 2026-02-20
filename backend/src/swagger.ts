export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Aurix API',
    version: '1.0.0',
    description: 'API do sistema de gestão comercial Aurix'
  },
  servers: [
    { url: 'http://localhost:3001', description: 'Desenvolvimento' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        tags: ['Sistema'],
        responses: { 200: { description: 'OK' } }
      }
    },
    '/api/auth/register': {
      post: {
        summary: 'Cadastrar usuário',
        tags: ['Autenticação'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', example: 'user@email.com' },
                  senha: { type: 'string', example: '123456' },
                  nome: { type: 'string', example: 'Nome' }
                },
                required: ['email', 'senha']
              }
            }
          }
        },
        responses: { 201: { description: 'Usuário criado' }, 400: { description: 'Erro de validação' } }
      }
    },
    '/api/auth/login': {
      post: {
        summary: 'Login',
        tags: ['Autenticação'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', example: 'admin@aurix.com' },
                  senha: { type: 'string', example: '123456' }
                },
                required: ['email', 'senha']
              }
            }
          }
        },
        responses: { 200: { description: 'Token e usuário' }, 401: { description: 'Credenciais inválidas' } }
      }
    },
    '/api/dashboard': {
      get: {
        summary: 'Métricas do dashboard',
        tags: ['Dashboard'],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Faturamento, vendas, estoque baixo, últimas vendas' }, 401: { description: 'Não autorizado' } }
      }
    },
    '/api/produtos': {
      get: {
        summary: 'Listar produtos',
        tags: ['Produtos'],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Lista de produtos' } }
      },
      post: {
        summary: 'Criar produto',
        tags: ['Produtos'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nome: { type: 'string' },
                  preco: { type: 'number' },
                  custo: { type: 'number' },
                  estoque_atual: { type: 'integer' },
                  estoque_minimo: { type: 'integer' }
                },
                required: ['nome', 'preco', 'custo', 'estoque_atual', 'estoque_minimo']
              }
            }
          }
        },
        responses: { 201: { description: 'Produto criado' } }
      }
    },
    '/api/produtos/{id}': {
      get: {
        summary: 'Obter produto',
        tags: ['Produtos'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Produto' }, 404: { description: 'Não encontrado' } }
      },
      put: {
        summary: 'Atualizar produto',
        tags: ['Produtos'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Produto atualizado' }, 404: { description: 'Não encontrado' } }
      },
      delete: {
        summary: 'Excluir produto',
        tags: ['Produtos'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Excluído' }, 404: { description: 'Não encontrado' } }
      }
    },
    '/api/clientes': {
      get: {
        summary: 'Listar clientes',
        tags: ['Clientes'],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Lista de clientes' } }
      },
      post: {
        summary: 'Criar cliente',
        tags: ['Clientes'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nome: { type: 'string' },
                  telefone: { type: 'string' },
                  observacoes: { type: 'string' }
                },
                required: ['nome']
              }
            }
          }
        },
        responses: { 201: { description: 'Cliente criado' } }
      }
    },
    '/api/clientes/{id}': {
      get: {
        summary: 'Obter cliente',
        tags: ['Clientes'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Cliente' }, 404: { description: 'Não encontrado' } }
      },
      put: {
        summary: 'Atualizar cliente',
        tags: ['Clientes'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Cliente atualizado' } }
      },
      delete: {
        summary: 'Excluir cliente',
        tags: ['Clientes'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Excluído' } }
      }
    },
    '/api/clientes/{id}/historico': {
      get: {
        summary: 'Histórico de compras do cliente',
        tags: ['Clientes'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Lista de vendas' } }
      }
    },
    '/api/vendas': {
      get: {
        summary: 'Listar vendas',
        tags: ['Vendas'],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Lista de vendas' } }
      },
      post: {
        summary: 'Registrar venda',
        tags: ['Vendas'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  cliente_id: { type: 'string' },
                  itens: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        produto_id: { type: 'string' },
                        quantidade: { type: 'integer' },
                        preco_unitario: { type: 'number' }
                      }
                    }
                  },
                  desconto: { type: 'number' },
                  forma_pagamento: { type: 'string' },
                  status: { type: 'string', enum: ['PAGO', 'PENDENTE'] }
                },
                required: ['cliente_id', 'itens', 'forma_pagamento']
              }
            }
          }
        },
        responses: { 201: { description: 'Venda criada' } }
      }
    },
    '/api/vendas/{id}': {
      get: {
        summary: 'Obter venda',
        tags: ['Vendas'],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Venda' }, 404: { description: 'Não encontrada' } }
      }
    },
    '/api/relatorios': {
      get: {
        summary: 'Relatório por período',
        tags: ['Relatórios'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'dataInicial', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'dataFinal', in: 'query', required: true, schema: { type: 'string', format: 'date' } }
        ],
        responses: { 200: { description: 'Total vendas, faturamento e lista de vendas' } }
      }
    },
    '/api/relatorios/exportar': {
      get: {
        summary: 'Exportar relatório CSV',
        tags: ['Relatórios'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'dataInicial', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'dataFinal', in: 'query', required: true, schema: { type: 'string', format: 'date' } }
        ],
        responses: { 200: { description: 'Arquivo CSV' } }
      }
    }
  }
};
