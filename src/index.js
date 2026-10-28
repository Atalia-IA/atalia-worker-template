/**
 * Agente de exemplo da Atalia.
 *
 *   POST /webhook   eventos da Atalia (assinados)
 *   GET  /health    verificação simples
 *   /               painel (conversas, agente, conexão), com a senha ADMIN_PASSWORD
 */
import { handleAdmin } from './admin.js';
import { handleWebhook } from './webhook.js';

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		if (url.pathname === '/webhook') {
			if (request.method !== 'POST') return new Response('Use POST.', { status: 405 });
			return handleWebhook(request, env, ctx);
		}
		if (url.pathname === '/health') return Response.json({ ok: true });

		return handleAdmin(request, env, url);
	},
};
