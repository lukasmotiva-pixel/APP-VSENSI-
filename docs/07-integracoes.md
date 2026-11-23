# 07 — Integrações externas (WhatsApp, Instagram, Modal)

Pesquisa feita em 23/11/2026 nas documentações da Meta e de provedores. **Nenhuma integração foi
simulada.** Enquanto elas não estiverem configuradas, o CRM e os pedidos funcionam com registro manual.

## WhatsApp — WhatsApp Business Platform (Cloud API)

**É possível**, pela API oficial (Cloud API, hospedada pela Meta). O sistema receberia mensagens por
*webhook* e poderia responder dentro da janela de atendimento.

O que é necessário (do lado da empresa):

1. Conta no **Meta Business Manager** (Gerenciador de Negócios) da V'Sensi, idealmente verificada.
2. Um **app** no painel de desenvolvedores da Meta com o produto WhatsApp e uma conta WhatsApp Business (WABA).
3. Decidir o número:
   - **Número novo** só para a API; ou
   - **Coexistência**: manter o número atual no aplicativo WhatsApp Business e conectá-lo também à API.
     Só vale para números já usados no app Business, é feita pelo *Embedded Signup*, sincroniza o
     histórico e, segundo provedores, desconecta aparelhos acompanhantes e desativa alguns recursos
     (ex.: editar/apagar mensagem). Não está disponível em todas as regiões.
4. Domínio com HTTPS público para receber os webhooks (o mesmo do sistema).
5. Meio de pagamento na conta da Meta.

**Custos:** a Meta cobra por mensagem, com preço por país do destinatário e por categoria
(marketing, utilidade, autenticação, serviço). Contas brasileiras podem ser faturadas em reais pela
Facebook Brasil. Fontes de terceiros indicam mudanças recentes na cobrança de mensagens de serviço;
**os valores devem ser conferidos na tabela oficial** antes de decidir:
https://developers.facebook.com/docs/whatsapp/pricing

## Instagram — Instagram API com login do Instagram (Messaging)

**É possível** receber e responder mensagens diretas (Direct) e comentários.

Requisitos:

1. Conta **profissional** do Instagram (comercial ou criador).
2. App na Meta com o produto Instagram e as permissões `instagram_business_basic`,
   `instagram_business_manage_messages` (e `instagram_business_manage_comments` para comentários).
3. Na conta do Instagram, ativar **"Permitir acesso a mensagens" / ferramentas conectadas** nas
   configurações de mensagens.
4. Como o app atenderia apenas a própria empresa, o **acesso padrão** é suficiente (a revisão do app
   pela Meta é exigida para provedores que atendem várias empresas).
5. O envio só é possível para quem iniciou a conversa (o ID do usuário vem do webhook), respeitando
   as janelas de resposta da Meta.

Documentação: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login

## O que será construído quando as contas estiverem prontas

- Endpoint de webhook autenticado (assinatura `X-Hub-Signature-256`) para receber mensagens.
- Caixa de entrada no CRM: conversas por cliente, pendentes de resposta, vinculação automática ao
  cadastro pelo telefone / ID do Instagram.
- Envio de respostas (incluindo as respostas rápidas) pela API.
- Tokens guardados como segredo no servidor (nunca no banco em texto puro).

## Modal

Não foi possível identificar publicamente qual é o aplicativo "Modal" usado no atendimento (a busca
pelo nome retorna apenas outros CRMs). **Não presumimos que exista API ou exportação.**

Próximos passos:

1. Informar o site/fornecedor do Modal e o plano contratado.
2. Verificar no próprio Modal se há exportação (CSV/Excel) de clientes, atendimentos e pedidos, ou API.
3. Com uma amostra exportada, mapear os campos para `customers`, `interactions` e `orders` e criar um
   importador com **pré-visualização**, deduplicação por telefone e relatório do que foi importado.
4. Rodar em paralelo por um período (Modal + sistema) antes de desativar o Modal.

Dados a preservar: clientes (nome, telefone, Instagram, cidade), histórico de atendimentos, pedidos
(itens, valores, status, datas, entrega) e responsáveis.
