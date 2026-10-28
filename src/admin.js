/**
 * Painel do worker (/) e a API dele (/admin/api/*), protegidos pela senha ADMIN_PASSWORD
 * (login do navegador; o usuário pode ser qualquer um).
 */
import { createAtaliaClient, timingSafeEqual } from './atalia.js';
import { ADMIN_HTML } from './admin-page.js';
import { DEFAULT_AGENT } from './agent.js';
import { sendAndRecord, webhookSecretState } from './webhook.js';
import {
	getAgent,
	getConversation,
	lastRejection,
	listConversations,
	listMessages,
	markRead,
	recentEvents,
	saveAgent,
	setBotPaused,
} from './store.js';

const json = (body, status = 200) => Response.json(body, { status });

function authorized(request, env) {
	const header = request.headers.get('Authorization') || '';
	if (!header.startsWith('Basic ')) return false;
	let decoded = '';
	try {
		decoded = atob(header.slice(6));
	} catch {
		return false;
	}
	const password = decoded.slice(decoded.indexOf(':') + 1);
	return timingSafeEqual(password, env.ADMIN_PASSWORD);
}

export async function handleAdmin(request, env, url) {
	if (!env.ADMIN_PASSWORD) {
		return new Response('Configure o segredo ADMIN_PASSWORD no worker para abrir o painel.', { status: 503 });
	}
	if (!authorized(request, env)) {
		return new Response('Senha necessária.', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Agente Atalia", charset="UTF-8"' } });
	}

	if (request.method === 'GET' && url.pathname === '/') {
		return new Response(ADMIN_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
	}
	if (!url.pathname.startsWith('/admin/api/')) return json({ error: 'not found' }, 404);

	// O navegador manda a senha sozinho em qualquer requisição; o header próprio impede que outro site
	// dispare uma ação aqui (ele não consegue enviar header customizado sem permissão de CORS).
	if (request.method !== 'GET' && request.headers.get('X-Admin') !== '1') return json({ error: 'forbidden' }, 403);

	const db = env.DB;
	const path = url.pathname.slice('/admin/api'.length);
	const body = request.method === 'GET' ? null : await request.json().catch(() => ({}));
	let match;

	if (request.method === 'GET' && path === '/conversations') {
		return json({ conversations: await listConversations(db) });
	}

	if ((match = path.match(/^\/conversations\/([^/]+)$/)) && request.method === 'GET') {
		const conversation = await getConversation(db, match[1]);
		if (!conversation) return json({ error: 'Conversa não encontrada.' }, 404);
		await markRead(db, conversation.id);
		return json({ conversation, messages: await listMessages(db, conversation.id) });
	}

	if ((match = path.match(/^\/conversations\/([^/]+)\/messages$/)) && request.method === 'POST') {
		const conversation = await getConversation(db, match[1]);
		if (!conversation) return json({ error: 'Conversa não encontrada.' }, 404);
		const text = typeof body.text === 'string' ? body.text.trim().slice(0, 4000) : '';
		if (!text) return json({ error: 'Escreva a mensagem.' }, 400);
		// Quem responde pelo painel assumiu a conversa: o agente para de responder
		if ((await getAgent(db)).pause_on_human_reply) await setBotPaused(db, conversation.id, true);
		const result = await sendAndRecord(env, conversation, text, { author: 'human', idempotencyKey: `manual-${crypto.randomUUID()}` });
		return json(result, result.ok ? 200 : 502);
	}

	if ((match = path.match(/^\/conversations\/([^/]+)\/bot$/)) && request.method === 'POST') {
		await setBotPaused(db, match[1], !!body.paused);
		return json({ ok: true, bot_paused: !!body.paused });
	}

	if (path === '/agent' && request.method === 'GET') {
		return json({ agent: await getAgent(db), defaults: DEFAULT_AGENT });
	}

	if (path === '/agent' && request.method === 'PUT') {
		return json({ agent: await saveAgent(db, body) });
	}

	if (path === '/status' && request.method === 'GET') {
		let channels = null;
		let channelsError = null;
		try {
			channels = await createAtaliaClient(env).listChannels();
		} catch (error) {
			channelsError = error.code ? `${error.code}: ${error.message}` : error.message;
		}
		return json({
			webhook_url: `${url.origin}/webhook`,
			api_key: !!env.ATALIA_API_KEY,
			webhook_secret: webhookSecretState(env),
			channels,
			channels_error: channelsError,
			last_rejection: await lastRejection(db),
			events: await recentEvents(db),
		});
	}

	if (path === '/webhook-test' && request.method === 'POST') {
		try {
			return json({ ok: true, result: await createAtaliaClient(env).testWebhook() });
		} catch (error) {
			return json({ ok: false, error: error.code ? `${error.code}: ${error.message}` : error.message }, 502);
		}
	}

	return json({ error: 'not found' }, 404);
}
