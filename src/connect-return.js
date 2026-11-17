/**
 * GET /retorno: para onde a página de conexão da Atalia manda o cliente da revenda de volta
 * (Atalia › Página de conexão › "Voltar para o seu sistema").
 *
 *   /retorno?status=connected&client_id=<id>&ref=<ref>&channels=whatsapp&t=<epoch>&sig=<hex>
 *
 * Rota PÚBLICA (quem chega é o cliente final, sem a senha do painel), por isso nada aqui é
 * confiável sem conferir a assinatura com o segredo do webhook. Num sistema real, este é o lugar
 * de levar a pessoa para a tela certa do seu produto (pelo `ref`). O dado oficial continua sendo o
 * evento client.connected no webhook: a pessoa pode fechar a página antes de voltar.
 */
import { verifyConnectReturn } from './atalia.js';
import { noteRejection, recordConnectReturn, upsertClient } from './store.js';
import { webhookSecretState } from './webhook.js';

const MESSAGES = {
	connected: ['Tudo certo!', 'Seus canais estão conectados. Já pode voltar ao atendimento.'],
	cancelled: ['Conexão não concluída', 'Nenhum canal foi conectado. Você pode tentar de novo quando quiser.'],
	no_slot: ['Falta liberar uma vaga', 'No momento não há vaga para um novo canal. Nossa equipe vai liberar e te avisar.'],
	invalid: ['Não conseguimos confirmar', 'Este link de retorno é inválido ou expirou. Se você acabou de conectar, está tudo certo: a confirmação chega por outro caminho.'],
};

const escapeHtml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(kind, status = 200) {
	const [title, body] = MESSAGES[kind] || MESSAGES.invalid;
	const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><link rel="icon" href="data:,">
<style>
	:root { --bg: #f4f5f9; --card: #fff; --text: #141a33; --muted: #5d6380; --line: #dfe2ea; --ok: #0f7a4f; color-scheme: light; }
	@media (prefers-color-scheme: dark) { :root { --bg: #0e1222; --card: #161b2e; --text: #e8eaf4; --muted: #9aa1bf; --line: #2a3150; --ok: #5fd39c; color-scheme: dark; } }
	body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--text); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; padding: 16px; box-sizing: border-box; }
	main { max-width: 420px; width: 100%; background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 32px 28px; text-align: center; }
	h1 { margin: 0 0 8px; font-size: 22px; }
	p { margin: 0; color: var(--muted); }
	.ok h1 { color: var(--ok); }
</style></head>
<body><main class="${kind === 'connected' ? 'ok' : ''}"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p></main></body></html>`;
	return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function handleConnectReturn(request, env) {
	const params = new URL(request.url).searchParams;
	const status = params.get('status');

	if (webhookSecretState(env) !== 'ok') {
		await noteRejection(env.DB, 'Retorno da página de conexão sem o segredo do webhook configurado (ATALIA_WEBHOOK_SECRET).');
		return page('invalid', 503);
	}
	if (!['connected', 'cancelled', 'no_slot'].includes(status) || !(await verifyConnectReturn(params, env.ATALIA_WEBHOOK_SECRET))) {
		await noteRejection(env.DB, 'Retorno da página de conexão com assinatura inválida ou expirada.');
		return page('invalid', 400);
	}

	const clientId = params.get('client_id');
	const ref = params.get('ref');
	const channels = params.get('channels');
	await recordConnectReturn(env.DB, { status, clientId, ref, channels, signedAt: Number(params.get('t')), sig: params.get('sig') });
	// O webhook (client.connected) também grava; quem chegar primeiro cria, o outro completa
	if (clientId && status !== 'cancelled') {
		await upsertClient(env.DB, { id: clientId, ref, status, channels });
	}
	return page(status);
}
