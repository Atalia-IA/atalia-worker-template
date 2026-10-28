# Textos para a IA

Textos prontos para colar no Claude, ChatGPT, Cursor ou outro assistente. Eles apontam para a referência da API em texto, que a IA consegue abrir sem login: https://chat.atalia.ai/docs/llms.txt

Nunca cole a chave da API na conversa. Diga que ela está numa variável de ambiente.

## 1. Construir este projeto do zero

Use quando quiser o mesmo sistema em outra linguagem ou plataforma (Node com Express, Python com FastAPI, PHP, n8n...). Troque o que está entre colchetes.

```text
Quero construir um sistema que atende os clientes da minha empresa pelo WhatsApp usando a Atalia.

Leia a documentação da API: https://chat.atalia.ai/docs/llms.txt
Use [Node.js com Express / Python com FastAPI / PHP / outra] e guarde os dados em [SQLite / Postgres / outro].

O sistema tem três partes:

1. Webhook (POST /webhook) que recebe os eventos da Atalia:
   - confere o header X-Atalia-Signature sobre o corpo CRU, com o segredo na variável ATALIA_WEBHOOK_SECRET, e recusa evento com mais de 5 minutos;
   - ignora evento repetido pelo id (evt_...);
   - grava a mensagem e responde 200 em menos de 10 segundos; a resposta da IA roda depois, fora da requisição;
   - message.received: grava a conversa (conversation_id, channel.id, contato) e a mensagem, e chama o agente;
   - message.echo: alguém respondeu pelo app; grava e pausa o agente naquela conversa;
   - message.status: atualiza a situação da mensagem enviada.

2. Agente simples:
   - instruções, modelo e quantidade de mensagens no histórico configuráveis;
   - usa as últimas mensagens da conversa como histórico (cliente = user, nossas respostas = assistant);
   - se o cliente escrever "atendente", "humano" ou "pessoa", responde que vai chamar alguém da equipe e pausa o agente na conversa;
   - foto, áudio ou arquivo: responde que por enquanto só lê texto;
   - envia a resposta por POST /api/v1/messages com o conversation_id do evento, a chave na variável ATALIA_API_KEY e o header Idempotency-Key "reply-<id da mensagem recebida>";
   - se outra mensagem do cliente chegou enquanto a IA pensava, não envia (a mais nova será respondida).

3. Painel protegido por senha (variável ADMIN_PASSWORD):
   - lista de conversas com a última mensagem e as não lidas;
   - histórico da conversa, campo para responder como pessoa da equipe (isso pausa o agente) e um botão para pausar ou religar o agente;
   - tela para editar a configuração do agente;
   - tela de conexão: lista os canais (GET /api/v1/channels), mostra o endereço do webhook e tem um botão que chama POST /api/v1/webhook/test.

Me explique como rodar, como publicar e como testar o fluxo inteiro. Escreva testes para a assinatura do webhook, para o evento repetido e para o pedido de atendente.
```

## 2. Adaptar este modelo

Abra este repositório no Cursor ou no Claude Code e use um destes, ou escreva o seu no mesmo formato.

**Dar uma ferramenta ao agente**

```text
Leia o README e o src/agent.js deste projeto e a referência da Atalia em https://chat.atalia.ai/docs/llms.txt.
Quero que o agente consulte o status de um pedido na minha API: GET https://minha-loja.com/api/pedidos/{numero}, com o token na variável LOJA_API_TOKEN.
Use function calling no modelo, mantenha os testes passando e adicione um teste para a ferramenta.
```

**Gravar os contatos no meu CRM**

```text
Leia o src/webhook.js deste projeto. A cada message.received, crie ou atualize o contato no meu CRM [nome do CRM e link da documentação da API dele], usando o telefone como chave. Não deixe uma falha do CRM impedir a resposta do agente nem o 200 do webhook.
```

**Responder com botões**

```text
Leia o src/atalia.js e o src/webhook.js deste projeto e a seção "Enviar mensagem" de https://chat.atalia.ai/docs/llms.txt.
Quando o cliente disser "oi" ou "olá", responda com três botões: "Fazer pedido", "Ver horário" e "Falar com atendente". Trate o clique em cada um.
```
