# Manual do Usuário — Aurix

**Sistema de Gestão Comercial e Agendamentos**

---

## 1️⃣ Apresentação do Sistema

### Nome do sistema
**Aurix** — Gestão Comercial

### O que ele faz
O Aurix é um sistema completo para pequenos negócios que reúne em um só lugar:

- **Controle de clientes** — cadastro, histórico e alertas de inatividade  
- **Cadastro de produtos** — preço, estoque e categorias  
- **Registro de vendas** — com desconto e formas de pagamento  
- **Relatórios** — faturamento e vendas por período, com exportação  
- **Agendamentos** — agenda com horários, bloqueios e link público para o cliente agendar

Tudo acessível pelo navegador, no celular ou no computador.

### Para quem é indicado
- Barbearias, salões e clínicas  
- Lojas e pequenos comércios  
- Prestadores de serviço que atendem com horário marcado  
- Qualquer negócio que queira organizar clientes, produtos, vendas e agenda sem complicação

### Principais benefícios
- **Tudo em um lugar:** clientes, produtos, vendas e agenda no mesmo sistema  
- **Visão do negócio:** dashboard com faturamento, total de vendas e alertas de estoque  
- **Menos cliente parado:** status do cliente (Ativo, Atenção, Inativo) e dias sem compra ajudam a reativar  
- **Agenda profissional:** clientes agendam pelo link; você controla horários e bloqueios  
- **Relatórios simples:** período que quiser e exportação em planilha (CSV)

### Diferenciais
- **Simplicidade:** telas objetivas, sem termos técnicos  
- **Retenção de clientes:** o sistema avisa quando o cliente está há muito tempo sem comprar  
- **Alertas de estoque:** produtos com estoque baixo aparecem no dashboard  
- **WhatsApp integrado:** botão para abrir conversa com o cliente direto no sistema  
- **Link público de agendamento:** um único link para seus clientes marcarem horário  
- **Antecedência mínima:** você define com quantos dias de antecedência o cliente pode agendar  

---

## 2️⃣ Primeiros Passos

### Como acessar o sistema
1. Abra o navegador (Chrome, Edge, Safari etc.).  
2. Digite o endereço que sua empresa recebeu (ex.: `https://seu-sistema.vercel.app`).  
3. A tela de login será exibida.

### Como fazer login
1. Informe seu **e-mail** (o mesmo cadastrado no sistema).  
2. Informe sua **senha**.  
3. Clique em **Entrar**.  
4. Se os dados estiverem corretos, você será levado ao **Dashboard**.

**Dica:** Guarde o endereço nos favoritos do navegador para acessar rápido.

### Como navegar pelo menu lateral
No lado esquerdo da tela há um menu fixo com as principais áreas:

| Ícone / Item      | O que é                          |
|-------------------|----------------------------------|
| **Dashboard**     | Visão geral do negócio           |
| **Clientes**      | Cadastro e lista de clientes     |
| **Produtos**      | Cadastro de produtos e categorias|
| **Vendas**        | Registrar e ver vendas           |
| **Agendamentos**  | Agenda e agendamentos            |
| **Relatórios**    | Relatórios por período           |
| **Configurações** | Configurações gerais e agenda    |

Clique em qualquer item para ir à tela correspondente. O item da tela em que você está fica destacado (fundo azul claro e texto azul).

### Explicação geral da interface
- **Topo:** nome do sistema (Aurix), seu usuário e opção de sair.  
- **Menu à esquerda:** navegação entre as áreas (em celular pode aparecer como ícone de menu).  
- **Área central:** conteúdo da tela escolhida (lista, formulário, gráficos etc.).  
- **Botões principais** (ex.: “Nova Venda”, “Cadastrar cliente”) costumam estar no canto superior direito da área central.

---

## 3️⃣ Dashboard

### O que é exibido
O Dashboard é a “home” do sistema. Nele você vê, em cards:

1. **Faturamento** — valor total das vendas no período escolhido  
2. **Total de vendas** — quantidade de vendas no período  
3. **Estoque baixo** — quantos produtos estão abaixo do estoque mínimo  
4. **Últimas vendas** — quantidade das últimas vendas listadas  

Você pode alternar o período entre **Este mês** e **Últimos 3 meses** (botões no topo).

### Como interpretar

**Faturamento do mês**  
- É a soma do valor de todas as vendas do mês atual (ou dos últimos 3 meses, se esse filtro estiver selecionado).  
- Use para acompanhar se o mês está bom em relação ao que você esperava.

**Total de vendas**  
- Número de vendas (quantidade de atendimentos/vendas), não o valor.  
- Ajuda a ver se você está vendendo mais ou menos em quantidade.

**Estoque baixo**  
- Mostra quantos produtos estão com estoque igual ou abaixo do mínimo que você definiu.  
- Abaixo dos números, a lista mostra quais produtos são e quantas unidades restam.  
- Use para repor estoque antes de faltar produto.

**Últimas vendas**  
- Resumo das vendas mais recentes (cliente, valor, status).  
- Útil para ter uma visão rápida do que está acontecendo.

### Como usar as informações para tomar decisões
- **Faturamento baixo?** Veja em Relatórios se caiu em relação a outros meses e pense em promoções ou divulgação.  
- **Muitos produtos com estoque baixo?** Priorize a compra desses itens.  
- **Poucas vendas no mês?** Use a tela de Clientes para filtrar “Inativos” ou “Atenção” e reativar por WhatsApp ou oferta.

---

## 4️⃣ Clientes

### Como cadastrar cliente
1. Vá em **Clientes** no menu.  
2. Clique no botão **Novo Cliente** (canto superior direito).  
3. Preencha:
   - **Nome** (obrigatório)  
   - **Telefone** (recomendado para WhatsApp e contato)  
   - **Observações** (opcional)  
   - **Status:** Ativo, Atenção ou Inativo  
4. Clique em **Salvar**.

O cliente passa a aparecer na lista e pode ser escolhido ao registrar uma venda.

### Última compra
- O sistema mostra a data da **última compra** de cada cliente quando você tem vendas registradas para ele.  
- Assim você sabe há quanto tempo ele não compra.

### Dias inativo
- **Dias inativo** é o número de dias desde a última compra.  
- Quanto maior esse número, mais tempo o cliente está sem voltar.  
- Use isso para priorizar quem reativar primeiro (ligação, WhatsApp, oferta).

### Status (Ativo, Atenção, Inativo)
- **Ativo:** cliente que compra com frequência ou que você considera em dia.  
- **Atenção:** cliente que está há um tempo sem comprar e merece um contato.  
- **Inativo:** cliente que há muito tempo não compra ou que você considera inativo.  

Você define o status ao cadastrar ou ao editar o cliente. O sistema não muda sozinho; o objetivo é você manter essa classificação para organizar a reativação.

### Como usar o filtro
No topo da lista de clientes há um filtro (geralmente botões ou um seletor):

- **Todos** — mostra todos os clientes  
- **Ativo** — só ativos  
- **Atenção** — só em atenção  
- **Inativo** — só inativos  

Use para, por exemplo, listar só “Inativos” e decidir a quem enviar mensagem ou oferta.

### Como usar o botão WhatsApp
- Na linha do cliente existe um botão (ícone do WhatsApp).  
- Ao clicar, o sistema abre o WhatsApp (app ou web) com o número do cliente já preenchido.  
- Basta escrever a mensagem e enviar.  
- Use para lembretes, ofertas ou reativação.

### Como o sistema ajuda a não perder clientes
- **Última compra e dias inativo** mostram quem está parado.  
- **Status** organiza quem está “ok”, “em atenção” ou “inativo”.  
- **Filtro** permite focar em um tipo (ex.: só inativos).  
- **WhatsApp** facilita o contato direto.  

Sugestão: uma vez por semana, filtre “Atenção” ou “Inativo”, veja os que têm mais dias inativo e envie uma mensagem ou oferta pelo WhatsApp.

---

## 5️⃣ Produtos

### Como cadastrar produto
1. Vá em **Produtos** no menu.  
2. Deixe selecionada a aba **Cadastro de Produtos**.  
3. Clique em **Novo Produto**.  
4. Preencha:
   - **Nome**  
   - **Categoria** (se já tiver categorias cadastradas)  
   - **Preço de venda**  
   - **Custo** (opcional, para controle)  
   - **Estoque atual**  
   - **Estoque mínimo** (quando o sistema deve avisar que está baixo)  
5. Clique em **Salvar**.

O produto passa a aparecer na lista e pode ser escolhido ao registrar uma venda.

### Como funcionam as categorias
- **Categorias** servem para agrupar produtos (ex.: “Cabelo”, “Barba”, “Produtos”).  
- Em **Produtos**, há uma aba **Categorias**. Lá você cria e edita categorias.  
- Ao cadastrar ou editar um produto, você escolhe a categoria na lista.  
- Isso ajuda a organizar a lista e a filtrar produtos por tipo.

### Como usar os filtros
Na tela de Cadastro de Produtos existem filtros para ver:

- **Todos** — todos os produtos  
- **Mais vendidos** — os que mais saíram no período  
- **Menos vendidos** — os que menos saíram no período  

E você pode escolher o período:

- **Este mês**  
- **Últimos 3 meses**  

Assim você identifica o que está vendendo mais e o que está parado.

### Como identificar produtos mais vendidos e menos vendidos
- Selecione o filtro **Mais vendidos** e o período (ex.: Este mês).  
- A lista mostrará os produtos em ordem de quantidade vendida.  
- Use **Menos vendidos** para ver o que quase não sai e decidir promoção, divulgação ou revisão de estoque.

---

## 6️⃣ Vendas

### Como registrar venda
1. Vá em **Vendas** no menu.  
2. Clique em **Nova Venda**.  
3. Selecione o **Cliente**.  
4. Adicione os **produtos** (busque pelo nome, informe a quantidade).  
5. Se quiser, informe **desconto** (em %).  
6. Selecione a **forma de pagamento**.  
7. Clique em **Registrar Venda** (ou equivalente).

A venda é criada e aparece na lista com status **Pendente** ou **Pago**, conforme você escolher.

### Como aplicar desconto percentual
- No formulário da venda há o campo **Desconto** (geralmente em %).  
- Digite o percentual (ex.: 10 para 10%).  
- O sistema recalcula o total com o desconto.  
- O valor final da venda já sai com o desconto aplicado.

### O que significam os status
- **Pendente:** venda registrada mas ainda não considerada paga (ex.: fiado, boleto não pago).  
- **Pago:** venda já recebida/paga.  

Não existe “Faturada” no sistema; use **Pago** quando o valor já tiver entrado.

### Como editar uma venda
- Na lista de vendas, localize a venda e clique nela (ou no botão de editar/detalhes).  
- Abre a tela de **detalhe** ou **edição**.  
- Ajuste itens, quantidade, desconto, forma de pagamento ou status.  
- Salve as alterações.

### Como evitar erros
- Confira **cliente**, **produtos** e **quantidades** antes de salvar.  
- Use **desconto** só quando tiver certeza do percentual.  
- Marque como **Pago** apenas quando o pagamento for confirmado.  
- Se errar, edite a venda assim que perceber; evite deixar dados errados na lista.

---

## 7️⃣ Relatórios

### Como filtrar por período
1. Vá em **Relatórios** no menu.  
2. Informe **Data inicial** e **Data final** (ex.: primeiro e último dia do mês).  
3. Clique em **Gerar Relatório**.

O sistema busca todas as vendas entre essas datas e mostra o resumo e a lista.

### Como interpretar a comparação
- O relatório mostra **Total de vendas** (quantidade) e **Faturamento total** (valor) no período.  
- Compare períodos diferentes (ex.: este mês x mês passado) gerando dois relatórios e anotando os números.  
- Assim você vê se está vendendo mais ou menos em quantidade e em valor.

### Como exportar o relatório
- Depois de gerar o relatório, aparece o botão **CSV** (ou “Exportar”).  
- Clique nele.  
- Será baixado um arquivo em formato planilha (CSV) que você pode abrir no Excel ou Google Planilhas.  
- Use para guardar histórico, fazer gráficos ou enviar para contador.

---

## 8️⃣ Agendamentos

### Como configurar horários
1. Vá em **Configurações** no menu e depois em **Agendamento** (ou no submenu de Agendamentos).  
2. Na seção **Dias e Horários de Atendimento**, para cada dia da semana (Segunda a Sábado) você pode:
   - **Ligar** o dia (ativo) e definir **hora de início** e **hora de fim**.  
   - **Desligar** o dia (não atende).  
3. Ajuste também:
   - **Duração do slot** (ex.: 30 ou 60 minutos).  
   - **Antecedência mínima** e **limite máximo** de dias para agendar.  
4. Use **Salvar Alterações** no topo da tela.

Assim o sistema só mostra para o cliente os dias e horários que você liberou.

### Como bloquear horários
- Na mesma tela de **Configurações > Agendamento** há a parte **Regras de Bloqueio**.  
- Você pode criar bloqueios:
  - **Por data:** intervalo de datas (ex.: férias, feriado) — pode ser dia inteiro ou só um período do dia.  
  - **Recorrente:** mesmo horário em um dia da semana (ex.: toda segunda das 12h às 14h).  
- Com isso, esses horários deixam de aparecer como disponíveis para o cliente.

### Como funciona a antecedência mínima
- **Antecedência mínima** é “com quantos dias de antecedência o cliente pode agendar”.  
- Ex.: se for 2 dias, o cliente não pode marcar para amanhã nem para depois de amanhã; o primeiro dia disponível é daqui a 3 dias.  
- Evita agendamentos de última hora e dá tempo de organizar a agenda.

### Como funciona o link público
- Em **Configurações > Agendamento** aparece a seção **Seu link público de agendamento**.  
- O sistema gera um link (ex.: `https://seu-dominio.com/agenda/sua-empresa`).  
- Você pode **copiar** o link e **alterar o apelido** (parte final da URL) se quiser um endereço mais fácil.  
- Envie esse link por WhatsApp, redes sociais ou site.  
- Quem clicar verá o calendário, escolherá o dia, o horário e preencherá nome e telefone; o agendamento cai na sua tela de **Agendamentos**.

### Como confirmar agendamentos
- Em **Agendamentos** você vê a lista (por dia, semana ou mês, conforme a visualização).  
- Cada agendamento tem **status:** Pendente, Confirmado ou Cancelado.  
- Para **confirmar**, abra o agendamento e altere o status para **Confirmado** (ou use o botão de confirmar, se existir).  
- Para **cancelar**, altere para **Cancelado**.  
- Você pode combinar com o cliente por WhatsApp e só então confirmar no sistema.

---

## 9️⃣ Boas Práticas

1. **Registrar vendas no momento do atendimento**  
   Anote a venda assim que o cliente pagar. Isso mantém faturamento, estoque e histórico de clientes corretos.

2. **Atualizar clientes corretamente**  
   Mantenha telefone e nome atualizados. Ajuste o status (Ativo, Atenção, Inativo) conforme o cliente voltar ou parar de comprar.

3. **Acompanhar o dashboard semanalmente**  
   Olhe pelo menos uma vez por semana o faturamento, o total de vendas e os produtos com estoque baixo para tomar decisões rápidas.

4. **Usar WhatsApp para reativar clientes**  
   Use o filtro de clientes “Atenção” ou “Inativo” e o botão do WhatsApp para enviar uma mensagem ou oferta e trazer o cliente de volta.

5. **Configurar a agenda com cuidado**  
   Defina bem os horários de atendimento e use bloqueios para férias e folgas, para o cliente não marcar em horários que você não atende.

6. **Conferir agendamentos pendentes**  
   Confirme ou cancele os agendamentos pendentes para evitar faltas e manter a agenda limpa.

---

**Fim do Manual**

*Este manual foi elaborado para apresentação e uso do sistema Aurix no dia a dia. Em caso de dúvidas, entre em contato com o suporte ou com quem configurou o sistema na sua empresa.*
