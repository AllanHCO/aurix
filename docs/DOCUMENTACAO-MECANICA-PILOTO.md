# Aurix — Documentação para Mecânicas e Clientes Piloto

**Sistema de Gestão Comercial para Oficinas Mecânicas**

*Documento completo: o que o software faz, benefícios para a oficina e material para venda aos primeiros clientes piloto.*

---

# Parte 1 — Visão geral para a oficina

## O que é o Aurix

O **Aurix** é um sistema web de gestão comercial feito para pequenos negócios. Para a **oficina mecânica**, ele reúne em um só lugar:

- **Clientes** — cadastro, histórico de serviços/peças, quem está há tempo sem voltar  
- **Produtos** — peças e serviços (nome, preço, custo, estoque, categoria)  
- **Vendas** — registro de cada atendimento (cliente, itens, desconto, pago/pendente)  
- **Agendamentos** — agenda com horários, bloqueios e **link público** para o cliente marcar revisão ou serviço  
- **Relatórios** — faturamento por período, comparação, exportação em planilha  
- **Dashboard** — faturamento, crescimento, ticket médio, meta, receita em risco, estoque baixo, próximos agendamentos  

Tudo acessível pelo **navegador** (celular ou computador), sem instalação.

---

## O que o software pode fazer — resumo executivo

| Área | O que o Aurix faz |
|------|-------------------|
| **Gestão de clientes** | Cadastro (nome, telefone, observações), última compra, dias sem voltar, status Ativo/Atenção/Inativo, histórico de compras, importação por CSV, botão WhatsApp para contato rápido. |
| **Retenção** | Cálculo automático de clientes em atenção e inativo (dias configuráveis), estimativa de “receita em risco” se não reativar, filtros para campanhas de reativação. |
| **Produtos e estoque** | Cadastro de produtos (peças/serviços), categorias, preço, custo, estoque atual e mínimo; alerta de estoque baixo; filtros por mais/menos vendidos e estoque baixo. |
| **Vendas** | Registrar venda com cliente, itens (produto + quantidade + preço), desconto %, forma de pagamento, status (Pago/Pendente/Fechada); código único; vínculo opcional com agendamento; edição; faturar em lote; controle de estoque (Pago baixa estoque, Pendente não). |
| **Agendamentos** | Agenda com visão mensal/semanal/diária; criar/editar; status Pendente/Confirmado/Cancelado; check-in e no-show; bloqueios por dia da semana ou por intervalo de datas; **agenda pública** por link (cliente agenda sem login). |
| **Agenda pública** | Link único (ex.: seu-dominio.com/agenda/sua-oficina); página com sua marca (nome, logo, cor); cliente escolhe data e horário disponível, preenche nome e telefone; opção de abrir WhatsApp após agendar. |
| **Configuração da agenda** | Horário de funcionamento, duração do slot, buffer entre atendimentos, antecedência mínima, limite de dias para agendar, disponibilidade por dia da semana, bloqueios. |
| **Dashboard** | Faturamento (só vendas pagas), variação %, ticket médio, quantidade de vendas, meta do mês, receita em risco (vendas pendentes + clientes que não voltaram), estoque baixo, próximos agendamentos, gráfico de desempenho, atividades recentes. Período: semana, mês, trimestre. |
| **Relatórios** | Faturamento, total de vendas, ticket médio por período (datas escolhidas); comparação com período anterior; lista de vendas; exportação CSV. |
| **Pendências** | Tela unificada: vendas pendentes e agendamentos pendentes; atalhos para Vendas e Agendamentos. |
| **Configurações** | Slug da agenda e link público; dias para cliente “atenção” e “inativo”; mensagens WhatsApp (templates: atenção, inativo, pós-venda, confirmação e lembrete de agenda); meta de faturamento; plano (FREE/TRIAL/PAID). |
| **WhatsApp** | Templates configuráveis com placeholders (ex.: {NOME}, {DIAS}); botão em cada cliente para abrir conversa; histórico de agendamentos com opção de exportar/WhatsApp. |

---

## Problemas que a oficina enfrenta e como o Aurix resolve

| Problema na oficina | Como o Aurix resolve |
|---------------------|----------------------|
| **Desorganização** (planilha, caderno, WhatsApp solto) | Tudo em um só lugar: clientes, peças/serviços, vendas, agenda e relatórios. |
| **Cliente que some** (não volta para revisão ou troca de óleo) | Status automático (Atenção/Inativo), dias sem comprar, estimativa de receita em risco e filtros para reativar; templates WhatsApp. |
| **Não saber se está crescendo ou caindo** | Dashboard com faturamento, crescimento %, ticket médio, meta e gráfico; relatórios por período com comparação. |
| **Agenda bagunçada** (só WhatsApp, horário errado) | Link público para o cliente agendar; você define horários e bloqueios; menos erro e menos ligação. |
| **Estoque no escuro** (falta peça na hora) | Alerta de estoque baixo no dashboard; estoque mínimo por produto; controle na venda (Pago baixa estoque). |
| **Dinheiro pendente** (fiado, orçamento não fechado) | Vendas Pago vs Pendente; dashboard mostra quanto está pendente; tela de Pendências; faturar em lote. |
| **Perder tempo com marcação** | Cliente agenda sozinho pelo link; você só confirma e faz check-in. |

---

## Diferenciais para a oficina

- **Retenção:** mostra quem está em Atenção/Inativo e quanto você pode recuperar reativando.  
- **Agenda profissional:** link único, página com sua marca, cliente agenda sem login; bloqueios e antecedência configuráveis.  
- **Visão clara:** dashboard com os números que importam (faturamento, meta, receita em risco, estoque baixo).  
- **Feito para pequeno negócio:** linguagem simples, uso no celular ou no computador, sem complicação.  
- **WhatsApp na ponta:** botão no cliente e templates prontos para atenção, inativo e pós-venda.

---

# Parte 2 — Módulos e funcionalidades (detalhado para mecânica)

## 2.1 Dashboard

**O que faz:** Primeira tela após o login; mostra o negócio em números.

| Recurso | Descrição | Benefício para a oficina |
|--------|-----------|---------------------------|
| Faturamento do período | Soma das vendas **pagas** (Semana/Mês/Trimestre) | Saber quanto entrou de fato no caixa. |
| Crescimento | Comparação com período anterior (%) | Ver se o mês está melhor ou pior que o anterior. |
| Ticket médio | Valor médio por venda no período | Ver se o cliente está gastando mais ou menos por visita. |
| Quantidade de vendas | Número de atendimentos/vendas no período | Complementar ao faturamento. |
| Meta de faturamento | Meta em reais (configurável); barra de progresso | Foco e acompanhamento da meta do mês. |
| Receita em risco | (1) Valor das vendas pendentes; (2) clientes que não voltaram + estimativa do que pode perder | Não esquecer de cobrar e de reativar cliente. |
| Estoque baixo | Lista de produtos com estoque ≤ mínimo | Repor peças antes de faltar. |
| Próximos agendamentos | Lista dos próximos (dia, hora, cliente) | Ver o dia sem abrir a agenda inteira. |
| Gráfico de desemho | Receita atual vs anterior no período | Tendência de crescimento ou queda. |
| Atividades recentes | Últimas vendas e próximos agendamentos | Acesso rápido ao que está acontecendo. |

---

## 2.2 Clientes

**O que faz:** Cadastro e gestão de clientes; suporte à reativação.

| Recurso | Descrição | Benefício para a oficina |
|--------|-----------|---------------------------|
| Cadastro | Nome, telefone, observações | Identificar e contatar o cliente. |
| Última compra | Data da última venda registrada | Saber há quanto tempo não volta. |
| Dias inativo | Dias desde a última compra | Priorizar quem reativar primeiro. |
| Status | Ativo / Atenção / Inativo (regras por dias configuráveis) | Organizar campanhas de revisão/lembrete. |
| Filtros | Todos, Ativo, Atenção, Inativo, Novos no mês, Retornaram no mês | Listar só quem interessa (ex.: inativos). |
| Histórico | Compras do cliente e total gasto | Entender perfil e valor do cliente. |
| Importação CSV | Importar lista de clientes em planilha | Migrar cadastro antigo. |
| Aba Retenção | Clientes em risco e recuperados no período | Foco em reativação. |
| Botão WhatsApp | Abre conversa com o número do cliente | Contato rápido para lembrete ou oferta. |
| Templates WhatsApp | Mensagens prontas (atenção, inativo, pós-venda) com {NOME}, {DIAS} | Padronizar e agilizar mensagens. |

---

## 2.3 Produtos (peças e serviços)

**O que faz:** Cadastro de produtos (peças e/ou serviços), categorias e estoque.

| Recurso | Descrição | Benefício para a oficina |
|--------|-----------|---------------------------|
| Cadastro | Nome, preço, custo, estoque atual, estoque mínimo, categoria, linha | Cadastrar peças e serviços (ex.: Revisão 10.000 km, Troca de óleo). |
| Categorias | CRUD de categorias; produto vinculado a uma categoria | Organizar por tipo (Filtros, Óleo, Serviços, etc.). |
| Estoque | Não permite negativo; Pago baixa estoque, Pendente não | Controle real de peças. |
| Estoque mínimo | Alerta quando estoque atual ≤ mínimo | Repor antes de faltar. |
| Filtros | Todos, Mais vendidos, Menos vendidos, Estoque baixo (por período) | Ver o que sai mais e o que está parado. |

---

## 2.4 Vendas

**O que faz:** Registro e gestão de vendas (atendimentos); controle de estoque e de pendências.

| Recurso | Descrição | Benefício para a oficina |
|--------|-----------|---------------------------|
| Nova venda | Cliente + itens (produto, quantidade, preço) + desconto % + forma de pagamento + status (Pago/Pendente) | Registrar cada atendimento (peças + mão de obra). |
| Código da venda | Código único por venda | Referência rápida (ex.: para orçamento). |
| Vínculo com agendamento | Opcional: vincular venda a um agendamento | Rastrear venda do agendamento. |
| Status | Pago (entra no faturamento e baixa estoque) / Pendente (não baixa estoque) / Fechada | Separar o que já entrou do que está fiado/pendente. |
| Edição | Alterar itens, desconto, forma de pagamento, status | Corrigir ou faturar depois. |
| Faturar em lote | Marcar várias vendas pendentes como pagas de uma vez | Agilizar quando receber vários pagamentos. |
| Lista e filtros | Por período, status (Pago/Pendente/Fechada), busca (código, cliente, telefone), paginação | Encontrar vendas e acompanhar pendências. |

---

## 2.5 Agendamentos

**O que faz:** Agenda interna e integração com a agenda pública.

| Recurso | Descrição | Benefício para a oficina |
|--------|-----------|---------------------------|
| Visões | Mensal, semanal, diária | Ver a semana ou o dia de um jeito claro. |
| Criar/editar | Nome, telefone, data, hora início/fim, observação, status | Marcar revisão ou serviço; ajustar quando precisar. |
| Status | Pendente, Confirmado, Cancelado | Organizar confirmações. |
| Check-in / No-show | Marcar quem compareceu ou faltou | Controle de comparecimento. |
| Resumo do dia | Total, pendentes, check-ins, no-shows, ocupação | Visão rápida do dia. |
| Histórico | Filtro por período e status; export/WhatsApp | Análise e contato em lote. |
| Link agenda pública | Configurações geram link único (ex.: /agenda/sua-oficina) | Cliente agenda sozinho pelo link. |

---

## 2.6 Agenda pública (cliente agenda sem login)

**O que faz:** Página acessível por link onde o cliente escolhe data e horário e cria o agendamento.

| Recurso | Descrição | Benefício para a oficina |
|--------|-----------|---------------------------|
| Link único | URL com slug da oficina (ex.: seu-dominio.com/agenda/oficina-joao) | Um link para WhatsApp, redes, site. |
| Branding | Nome da empresa, unidade, logo, cor, status ativo | Página com a cara da oficina. |
| Dias e horários | Mostra só o que está disponível (funcionamento, bloqueios, já agendado) | Cliente vê só o que pode marcar. |
| Formulário | Nome e telefone do cliente; confirmação | Dados mínimos; agendamento cai na sua agenda. |
| WhatsApp após agendar | Opção de abrir WhatsApp após confirmar | Cliente pode mandar mensagem na hora. |

---

## 2.7 Configuração da agenda

**O que faz:** Define como a agenda e o link público funcionam.

| Recurso | Descrição | Benefício para a oficina |
|--------|-----------|---------------------------|
| Slug | Identificador único do link (ex.: oficina-joao); validação e sugestão automática | Link curto e fácil de divulgar. |
| Duração do slot | Tempo padrão de cada horário (ex.: 30 min) | Ajustar ao tipo de serviço. |
| Buffer | Intervalo entre um agendamento e outro | Tempo para troca de cliente/veículo. |
| Antecedência mínima | Quantos dias antes o cliente pode agendar | Evitar marcação de última hora. |
| Limite de dias | Até quantos dias à frente o cliente pode agendar | Controle de horizonte. |
| Nome do serviço padrão | Texto exibido na agenda pública (ex.: “Revisão ou serviço”) | Personalizar a mensagem. |
| Disponibilidade semanal | Por dia da semana: ativo e horário início/fim | Ex.: segunda a sexta 8h–18h. |
| Bloqueios | Recorrentes (ex.: toda segunda 12h–14h) ou por intervalo de datas (ex.: 25/12) | Almoço, férias, feriado. |

---

## 2.8 Bloqueios

**O que faz:** Bloquear horários para não aparecerem na agenda (pública e interna).

| Recurso | Descrição | Benefício para a oficina |
|--------|-----------|---------------------------|
| Recorrentes | Dia da semana + horário (ex.: segunda 12h–14h) | Almoço, reunião fixa. |
| Por intervalo | Data início e fim | Férias, feriado. |
| Lista e remoção | Ver todos os bloqueios e remover | Ajustar quando precisar. |

---

## 2.9 Relatórios

**O que faz:** Números por período e exportação.

| Recurso | Descrição | Benefício para a oficina |
|--------|-----------|---------------------------|
| Período | Data inicial e final | Relatório do mês, trimestre, ano. |
| Faturamento | Soma das vendas pagas no período | Quanto entrou. |
| Total de vendas | Quantidade de vendas | Volume de atendimentos. |
| Ticket médio | Faturamento ÷ quantidade | Média por atendimento. |
| Comparação | Período anterior (valor e %) | Crescimento ou queda. |
| Lista de vendas | Vendas do período, paginada | Detalhe. |
| Exportar CSV | Planilha do relatório | Contador, backup, análise. |

---

## 2.10 Pendências

**O que faz:** Visão unificada do que está pendente.

| Recurso | Descrição | Benefício para a oficina |
|--------|-----------|---------------------------|
| Vendas pendentes | Lista de vendas com status Pendente | Cobrança e faturar em lote. |
| Agendamentos pendentes | Lista de agendamentos pendentes de confirmar | Confirmar ou remarcar. |
| Atalhos | Links para Vendas e Agendamentos | Ação rápida. |

---

## 2.11 Configurações gerais

**O que faz:** Ajustes da conta e do negócio.

| Recurso | Descrição | Benefício para a oficina |
|--------|-----------|---------------------------|
| Slug e link da agenda | Ver e editar slug; exibir link público | Divulgar o link certo. |
| Retenção | Dias para cliente “atenção” e “inativo” | Ajustar à realidade da oficina. |
| Mensagens WhatsApp | Templates: atenção, inativo, pós-venda, confirmação de agenda, lembrete de agenda | Mensagens padronizadas e rápidas. |
| Meta de faturamento | Meta do mês em reais | Usada no dashboard. |
| Plano | FREE / TRIAL / PAID; trial_ends_at; bloqueio com motivo | Controle de assinatura. |
| Demo | Gerar e resetar dados de demonstração | Testar sem sujar dados reais. |

---

# Parte 3 — Tabela de referência rápida (tudo que o software pode fazer)

| Módulo | Funcionalidade | Sim/Não |
|--------|----------------|---------|
| Auth | Login (e-mail/senha, JWT) | Sim |
| Auth | Registro de nova conta | Sim |
| Dashboard | Faturamento do período (semana/mês/trimestre) | Sim |
| Dashboard | Crescimento % vs período anterior | Sim |
| Dashboard | Ticket médio | Sim |
| Dashboard | Quantidade de vendas | Sim |
| Dashboard | Meta de faturamento e barra de progresso | Sim |
| Dashboard | Receita em risco (vendas pendentes + clientes que não voltaram) | Sim |
| Dashboard | Estoque baixo (lista e atalho) | Sim |
| Dashboard | Próximos agendamentos | Sim |
| Dashboard | Gráfico de desempenho (atual vs anterior) | Sim |
| Dashboard | Atividades recentes | Sim |
| Clientes | CRUD (nome, telefone, observações) | Sim |
| Clientes | Última compra e dias inativo | Sim |
| Clientes | Status Ativo/Atenção/Inativo (regras por dias) | Sim |
| Clientes | Filtros (todos, ativo, atenção, inativo, novos, retornaram) | Sim |
| Clientes | Histórico de compras e total gasto | Sim |
| Clientes | Importação CSV | Sim |
| Clientes | Aba Retenção (em risco e recuperados) | Sim |
| Clientes | Botão WhatsApp | Sim |
| Clientes | Templates WhatsApp (atenção, inativo, pós-venda) | Sim |
| Produtos | CRUD (nome, preço, custo, estoque, mínimo, categoria, linha) | Sim |
| Produtos | Categorias (CRUD) | Sim |
| Produtos | Estoque (não negativo; Pago baixa, Pendente não) | Sim |
| Produtos | Alerta estoque baixo | Sim |
| Produtos | Filtros (todos, mais/menos vendidos, estoque baixo) | Sim |
| Vendas | Nova venda (cliente, itens, desconto %, forma de pagamento, status) | Sim |
| Vendas | Código único da venda | Sim |
| Vendas | Vínculo opcional com agendamento | Sim |
| Vendas | Status Pago/Pendente/Fechada | Sim |
| Vendas | Edição de venda | Sim |
| Vendas | Faturar em lote | Sim |
| Vendas | Lista com filtro (período, status, busca) e paginação | Sim |
| Agendamentos | Visão mensal/semanal/diária | Sim |
| Agendamentos | Criar/editar (nome, telefone, data, hora, observação, status) | Sim |
| Agendamentos | Status Pendente/Confirmado/Cancelado | Sim |
| Agendamentos | Check-in e no-show | Sim |
| Agendamentos | Resumo do dia | Sim |
| Agendamentos | Histórico com filtros e export/WhatsApp | Sim |
| Agenda pública | Link único por slug | Sim |
| Agenda pública | Branding (nome, logo, cor) | Sim |
| Agenda pública | Dias e horários disponíveis | Sim |
| Agenda pública | Cliente agenda sem login (nome e telefone) | Sim |
| Agenda pública | Opção abrir WhatsApp após agendar | Sim |
| Config. agenda | Slug (único, sugestão automática) | Sim |
| Config. agenda | Duração slot, buffer, antecedência, limite dias | Sim |
| Config. agenda | Nome serviço padrão | Sim |
| Config. agenda | Disponibilidade semanal por dia | Sim |
| Bloqueios | Recorrentes (dia da semana + horário) | Sim |
| Bloqueios | Por intervalo de datas | Sim |
| Bloqueios | Lista e remover | Sim |
| Relatórios | Período (datas), faturamento, total vendas, ticket médio | Sim |
| Relatórios | Comparação com período anterior | Sim |
| Relatórios | Lista de vendas e exportação CSV | Sim |
| Pendências | Vendas pendentes e agendamentos pendentes | Sim |
| Pendências | Atalhos para Vendas e Agendamentos | Sim |
| Configurações | Slug, link público, retenção, mensagens WhatsApp, meta, plano, demo | Sim |

---

# Parte 4 — Venda para os primeiros clientes piloto

## Por que falar com oficinas piloto

Os **primeiros clientes piloto** ajudam a validar o uso do Aurix na rotina real de uma oficina e a ajustar o produto. Em troca, a oficina ganha:

- **Condições especiais** (ex.: período de trial estendido, preço piloto, suporte prioritário).  
- **Influência** nas melhorias (feedback direto no produto).  
- **Organização desde o início** (menos planilha e WhatsApp solto, mais controle).

---

## O que a oficina piloto ganha (argumentos de venda)

| Benefício | Mensagem para o piloto |
|-----------|-------------------------|
| **Tudo em um lugar** | Clientes, peças/serviços, vendas e agenda em um único sistema; menos perda de informação. |
| **Saber quanto faturou** | Dashboard com faturamento, crescimento e ticket médio; decisão com número, não com “achismo”. |
| **Não perder cliente** | Sistema avisa quem está há tempo sem voltar e estima quanto você pode recuperar; filtros e WhatsApp para reativar. |
| **Agenda profissional** | Um link para o cliente marcar revisão ou serviço; menos ligação e menos marcação errada. |
| **Controle de estoque** | Alerta de estoque baixo; venda paga baixa estoque automaticamente. |
| **Controle de pendências** | Vendas pendentes e agendamentos pendentes em uma tela; faturar em lote quando receber. |
| **Relatórios e exportação** | Faturamento por período e planilha (CSV) para o contador ou análise. |
| **Ser piloto** | Condições especiais e suporte próximo; sua opinião ajuda a moldar o produto. |

---

## Objeções comuns e respostas

| Objeção | Resposta sugerida |
|---------|-------------------|
| “Já uso planilha/WhatsApp.” | “Planilha e WhatsApp não avisam quem não voltou, não mostram receita em risco nem estoque baixo. O Aurix junta tudo e ainda gera o link da agenda.” |
| “Não tenho tempo para aprender sistema.” | “O Aurix foi feito para pequeno negócio: telas simples, uso no celular. O essencial é cadastrar clientes, produtos e vendas; o resto você usa aos poucos.” |
| “E se eu precisar de algo específico de oficina?” | “Hoje o sistema cobre clientes, produtos (peças/serviços), vendas, estoque e agenda. Os primeiros pilotos ajudam a definir o que falta (ex.: placa, modelo do carro) para as próximas versões.” |
| “Quanto custa?” | “Para pilotos, [definir: trial estendido / preço especial]. O foco é validar o uso na sua oficina e evoluir o produto com seu feedback.” |

---

## Checklist de onboarding (piloto)

- [ ] Conta criada e login testado.  
- [ ] **Configurações:** definir slug da agenda e ver o link público; ajustar dias de atenção/inativo se quiser.  
- [ ] **Produtos:** cadastrar categorias (ex.: Óleo, Filtros, Serviços) e alguns produtos (peças e serviços).  
- [ ] **Clientes:** cadastro manual ou importação CSV; conferir se telefone está certo para WhatsApp.  
- [ ] **Vendas:** registrar 1–2 vendas de teste (Pago e Pendente); conferir estoque e dashboard.  
- [ ] **Agenda:** configurar horário de funcionamento e disponibilidade; criar 1 bloqueio de teste.  
- [ ] **Agenda pública:** abrir o link no celular, fazer um agendamento de teste; conferir na tela de Agendamentos.  
- [ ] **Dashboard:** explicar faturamento, receita em risco, estoque baixo e próximos agendamentos.  
- [ ] **Relatórios:** gerar relatório de um período e exportar CSV.  
- [ ] **Mensagens WhatsApp:** mostrar templates e botão no cliente; opcional: personalizar textos.  

---

## Frases prontas para uso comercial

- *“O Aurix reúne clientes, peças, vendas e agenda em um só lugar. Você vê quanto faturou, quem não voltou e quanto está pendente, e ainda oferece um link para o cliente marcar horário sozinho.”*  
- *“Para a oficina que quer sair da planilha e do WhatsApp solto, o Aurix organiza tudo e ainda avisa quando o cliente está há tempo sem voltar e quando uma peça está no estoque mínimo.”*  
- *“Os primeiros clientes piloto usam o sistema em condições especiais e ajudam a definir as próximas melhorias. Sua oficina ganha organização e influência no produto.”*

---

**Fim da documentação**

*Este documento pode ser usado em reuniões com oficinas, em propostas para clientes piloto e como base para treinamento e material de venda. Para detalhes de uso tela a tela, consulte o **Manual do Usuário** (MANUAL-DO-USUARIO.md).*
