/**
 * Cliente da API de integração da Atalia (v1) e verificação da assinatura do webhook.
 * Referência completa da API: https://chat.atalia.ai/docs/llms.txt
 */

const DEFAULT_API_URL = 'https://chat.atalia.ai/api/v1';
// Evento assinado há mais de 5 minutos é recusado: protege contra alguém reenviar um evento capturado.
const SIGNATURE_TOLERANCE_SECONDS = 300;
const encoder = new TextEncoder();

export class AtaliaError extends Error {
	constructor(status, code, message) {
		super(message || code || `HTTP ${status}`);
		this.status = status;
		this.code = code || `HTTP_${status}`;
	}
}

export function createAtaliaClient(env) {
	const base = (env.ATALIA_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

	async function request(method, path, body, headers = {}) {
		if (!env.ATALIA_API_KEY) throw new AtaliaError(0, 'MISSING_API_KEY', 'Configure o segredo ATALIA_API_KEY no worker.');
		const res = await fetch(base + path, {
			method,
			headers: {
				'x-api-key': env.ATALIA_API_KEY,
				...(body ? { 'Content-Type': 'application/json' } : {}),
				...headers,
			},
			body: body ? JSON.stringify(body) : undefined,
		});
		const payload = await res.json().catch(() => null);
		if (!res.ok) throw new AtaliaError(res.status, payload?.error?.code, payload?.error?.message);
		return payload?.data;
	}

	return {
		listChannels: () => request('GET', '/channels'),
		// Responder sempre pelo conversation_id do evento: funciona no WhatsApp, no Instagram e no Messenger.
		// A Idempotency-Key faz uma nova tentativa devolver a mesma mensagem em vez de enviar duas vezes.
		sendText: ({ channelId, conversationId, text, idempotencyKey }) =>
			request(
				'POST',
				'/messages',
				{ channel_id: channelId, conversation_id: conversationId, type: 'text', text },
				idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
			),
		testWebhook: () => request('POST', '/webhook/test'),
		// Revenda: cria o cliente e devolve o link da página de conexão (connect_url, 7 dias)
		createClient: ({ name, email, taxId, ref, sendEmail }) =>
			request('POST', '/clients', {
				name,
				email,
				...(taxId ? { tax_id: taxId } : {}),
				...(ref ? { ref } : {}),
				send_email: !!sendEmail,
			}),
		newClientLink: (clientId) => request('POST', `/clients/${encodeURIComponent(clientId)}/invite`, {}),
	};
}

/**
 * Confere o retorno da página de conexão (`/retorno?status=...&t=...&sig=...`):
 * sig = HMAC-SHA256(segredo do webhook, "<t>.<status>.<client_id>.<ref>.<channels>"), valores crus,
 * vazio para o que faltar. Recusa retorno assinado há mais de 5 minutos.
 */
export async function verifyConnectReturn(params, secret, nowSeconds = Date.now() / 1000) {
	const get = (k) => params.get(k) || '';
	const t = Number(get('t'));
	const sig = get('sig').toLowerCase();
	if (!secret || !sig || !Number.isFinite(t)) return false;
	if (Math.abs(nowSeconds - t) > SIGNATURE_TOLERANCE_SECONDS) return false;
	const expected = await hmacHex(secret, `${get('t')}.${get('status')}.${get('client_id')}.${get('ref')}.${get('channels')}`);
	return timingSafeEqual(expected, sig);
}

/**
 * Confere o header X-Atalia-Signature (`t=<epoch>,v1=<hex>`): HMAC-SHA256 do segredo sobre "<t>.<corpo cru>".
 * Sempre sobre o corpo CRU, antes de qualquer JSON.parse.
 */
export async function verifySignature(rawBody, header, secret, nowSeconds = Date.now() / 1000) {
	if (!header || !secret) return false;
	const parts = {};
	for (const piece of header.split(',')) {
		const i = piece.indexOf('=');
		if (i > 0) parts[piece.slice(0, i).trim()] = piece.slice(i + 1).trim();
	}
	const timestamp = Number(parts.t);
	if (!parts.v1 || !Number.isFinite(timestamp)) return false;
	if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;
	const expected = await hmacHex(secret, `${parts.t}.${rawBody}`);
	return timingSafeEqual(expected, parts.v1.toLowerCase());
}

export async function hmacHex(secret, payload) {
	const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
	return Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqual(a, b) {
	if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}
