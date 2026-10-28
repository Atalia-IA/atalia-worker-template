/**
 * POST /webhook: recebe os eventos da Atalia.
 *
 * 1. Confere a assinatura sobre o corpo cru.
 * 2. Ignora evento repetido (mesmo evt_...).
 * 3. Grava o que chegou e responde 200 na hora (a Atalia espera no máximo 10 segundos).
 * 4. A resposta da IA roda depois, em ctx.waitUntil.
 */
import { createAtaliaClient, verifySignature } from './atalia.js';
import { buildPrompt, generateReply, wantsHuman } from './agent.js';
import {
	addMessage,
	claimEvent,
	getAgent,
	getConversation,
	latestInboundId,
	messageExists,
	noteRejection,
	recentHistory,
	releaseEvent,
	setBotPaused,
	updateMessageStatus,
	upsertConversation,
} from './store.js';

const json = (body, status = 200) => Response.json(body, { status });

export function webhookSecretState(env) {
	const secret = env.ATALIA_WEBHOOK_SECRET;
	if (!secret) return 'missing';
	return secret.startsWith('whsec_') ? 'ok' : 'placeholder';
}

export async function handleWebhook(request, env, ctx) {
	const raw = await request.text();

	if (webhookSecretState(env) !== 'ok') {
		await noteRejection(env.DB, 'O segredo do webhook ainda não foi configurado no worker (ATALIA_WEBHOOK_SECRET).');
		return json({ error: 'webhook secret not configured' }, 503);
	}
	if (!(await verifySignature(raw, request.headers.get('X-Atalia-Signature'), env.ATALIA_WEBHOOK_SECRET))) {
		await noteRejection(env.DB, 'Assinatura inválida: confira se o segredo do worker é o mesmo da Atalia (e se o relógio do evento tem menos de 5 minutos).');
		return json({ error: 'invalid signature' }, 401);
	}

	let event;
	try {
		event = JSON.parse(raw);
	} catch {
		return json({ error: 'invalid json' }, 400);
	}
	if (!event?.id || !event?.type) return json({ error: 'invalid event' }, 400);

	if (!(await claimEvent(env.DB, event, summarize(event)))) return json({ ok: true, duplicate: true });

	let followUp;
	try {
		followUp = await applyEvent(env, event);
	} catch (error) {
		// Libera o evento para a nova tentativa da Atalia ser processada
		await releaseEvent(env.DB, event.id);
		throw error;
	}
	if (followUp) ctx.waitUntil(followUp().catch((error) => console.error('[agente] falha ao responder', error)));
	return json({ ok: true });
}

function summarize(event) {
	const message = event.data?.message;
	switch (event.type) {
		case 'message.received':
		case 'message.echo':
			return `${message?.contact?.name || message?.contact?.phone || 'Contato'}: ${message?.text || `[${message?.type || 'mídia'}]`}`.slice(0, 200);
		case 'message.status':
			return `${event.data?.status} (${event.data?.message_id})`;
		case 'ping':
			return 'Teste enviado pela Atalia';
		default:
			return event.channel?.id ? `Canal ${event.channel.id}` : null;
	}
}

/**
 * Grava o efeito do evento. Devolve a FUNÇÃO que responde o cliente, quando houver: devolver a promessa
 * faria o `await` desta função async esperar a IA, e o 200 só sairia depois dela.
 */
async function applyEvent(env, event) {
	const db = env.DB;
	switch (event.type) {
		case 'message.received': {
			const { message, conversation_id: conversationId } = event.data || {};
			if (!message?.id || !conversationId) return null;
			await upsertConversation(db, { id: conversationId, channel: event.channel, clientId: event.client_id, contact: message.contact });
			const isNew = await addMessage(db, {
				id: message.id,
				conversationId,
				direction: 'inbound',
				author: 'contact',
				type: message.type,
				text: message.text,
				status: message.status,
				externalId: message.external_id,
			});
			return isNew ? () => replyTo(env, String(conversationId), message) : null;
		}

		case 'message.echo': {
			// Alguém respondeu pelo app (WhatsApp Business em coexistência, Instagram ou Messenger)
			const { message, conversation_id: conversationId } = event.data || {};
			if (!message?.id || !conversationId) return null;
			if (await messageExists(db, { id: message.id, externalId: message.external_id })) return null;
			await upsertConversation(db, { id: conversationId, channel: event.channel, clientId: event.client_id, contact: message.contact });
			await addMessage(db, {
				id: message.id,
				conversationId,
				direction: 'outbound',
				author: 'app',
				type: message.type,
				text: message.text,
				status: message.status,
				externalId: message.external_id,
			});
			if ((await getAgent(db)).pause_on_human_reply) await setBotPaused(db, conversationId, true);
			return null;
		}

		case 'message.status': {
			const { message_id: id, status, external_id: externalId, errors } = event.data || {};
			if (!id || !status) return null;
			const error = errors?.length ? errors.map((e) => `${e.code}: ${e.title}`).join('; ') : null;
			await updateMessageStatus(db, { id, status, externalId, error });
			return null;
		}

		// ping, channel.*, client.*: ficam só na lista de eventos (aba Conexão)
		default:
			return null;
	}
}

/** O agente responde uma mensagem do cliente (roda depois do 200). */
export async function replyTo(env, conversationId, inbound) {
	const db = env.DB;
	const agent = await getAgent(db);
	if (!agent.enabled) return;
	const conversation = await getConversation(db, conversationId);
	if (!conversation || conversation.bot_paused) return;

	let text;
	if (!inbound.text) {
		text = agent.media_reply;
		if (!text) return;
	} else if (wantsHuman(inbound.text, agent.handoff_keywords)) {
		await setBotPaused(db, conversationId, true);
		text = agent.handoff_message;
		if (!text) return;
	} else {
		const history = await recentHistory(db, conversationId, agent.history_limit);
		try {
			text = await generateReply(env, agent, buildPrompt(agent, history, conversation.contact_name));
		} catch (error) {
			await recordFailure(db, conversationId, 'bot', `Erro da IA: ${error.message}`);
			return;
		}
		// Chegou outra mensagem do cliente enquanto a IA pensava: a resposta a ela já leva esta em conta
		if ((await latestInboundId(db, conversationId)) !== inbound.id) return;
		// Alguém assumiu a conversa no meio do caminho
		if ((await getConversation(db, conversationId))?.bot_paused) return;
	}

	await sendAndRecord(env, conversation, text, { author: 'bot', idempotencyKey: `reply-${inbound.id}` });
}

/** Envia pela Atalia e grava no histórico; envio recusado fica gravado como falha, com o motivo. */
export async function sendAndRecord(env, conversation, text, { author, idempotencyKey }) {
	try {
		const data = await createAtaliaClient(env).sendText({
			channelId: conversation.channel_id,
			conversationId: conversation.id,
			text,
			idempotencyKey,
		});
		await addMessage(env.DB, {
			id: data.id,
			conversationId: conversation.id,
			direction: 'outbound',
			author,
			text,
			status: data.status || 'pending',
		});
		return { ok: true, id: data.id };
	} catch (error) {
		const reason = error.code ? `${error.code}: ${error.message}` : error.message;
		await recordFailure(env.DB, conversation.id, author, reason, text);
		return { ok: false, error: reason };
	}
}

async function recordFailure(db, conversationId, author, reason, text = null) {
	await addMessage(db, {
		id: `local_${crypto.randomUUID()}`,
		conversationId,
		direction: 'outbound',
		author,
		text,
		status: 'failed',
		error: reason,
	});
}
