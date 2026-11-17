import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index.js';
import { verifySignature, hmacHex } from '../src/atalia.js';
import { normalizeAgent, wantsHuman, DEFAULT_AGENT } from '../src/agent.js';
import { saveAgent, setBotPaused } from '../src/store.js';
import { SECRET, receivedEvent, signedRequest, testEnv } from './helpers.js';

let t;
beforeEach(() => {
	t = testEnv();
	vi.stubGlobal('fetch', t.fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const deliver = async (event, options) => worker.fetch(await signedRequest(event, options), t.env, t.ctx);
const rows = (sql, ...args) => t.env.DB.sqlite.prepare(sql).all(...args);
const sends = () => t.sent.filter((s) => s.url.endsWith('/messages'));

describe('assinatura', () => {
	it('confere o HMAC sobre o corpo cru e recusa adulterado ou velho', async () => {
		const now = 1_800_000_000;
		const sig = await hmacHex(SECRET, `${now}.{"a":1}`);
		expect(await verifySignature('{"a":1}', `t=${now},v1=${sig}`, SECRET, now)).toBe(true);
		expect(await verifySignature('{"a":2}', `t=${now},v1=${sig}`, SECRET, now)).toBe(false);
		expect(await verifySignature('{"a":1}', `t=${now},v1=${sig}`, 'whsec_outro', now)).toBe(false);
		expect(await verifySignature('{"a":1}', `t=${now},v1=${sig}`, SECRET, now + 301)).toBe(false);
		expect(await verifySignature('{"a":1}', null, SECRET, now)).toBe(false);
	});

	it('webhook com assinatura errada: 401 e nada gravado; sem segredo: 503', async () => {
		const res = await deliver(receivedEvent(), { secret: 'whsec_errado' });
		expect(res.status).toBe(401);
		expect(rows('SELECT * FROM messages')).toHaveLength(0);
		expect(rows("SELECT * FROM settings WHERE key = 'last_rejection'")).toHaveLength(1);

		t.env.ATALIA_WEBHOOK_SECRET = 'depois';
		expect((await deliver(receivedEvent())).status).toBe(503);
	});
});

describe('mensagem recebida', () => {
	it('grava, responde 200 e o agente responde pela conversation_id com Idempotency-Key', async () => {
		const event = receivedEvent();
		const res = await deliver(event);
		expect(res.status).toBe(200);
		await t.settle();

		expect(rows('SELECT author, text, status FROM messages ORDER BY rowid')).toEqual([
			{ author: 'contact', text: 'Oi, vocês entregam hoje?', status: 'received' },
			{ author: 'bot', text: 'Entregamos sim, em até 2 dias úteis!', status: 'pending' },
		]);
		const [send] = sends();
		expect(send.body).toEqual({ channel_id: 'ch_2f81a9c0d1', conversation_id: '48213', type: 'text', text: 'Entregamos sim, em até 2 dias úteis!' });
		expect(send.headers['x-api-key']).toBe('atk_live_teste');
		expect(send.headers['Idempotency-Key']).toBe(`reply-${event.data.message.id}`);
		// O modelo recebe as instruções e o nome do cliente
		expect(t.ai.calls[0].input.messages[0].content).toContain('O nome do cliente é Maria.');
	});

	it('evento repetido (mesmo evt_) não responde duas vezes', async () => {
		const event = receivedEvent();
		await deliver(event);
		await t.settle();
		const again = await deliver(event);
		expect(await again.json()).toEqual({ ok: true, duplicate: true });
		await t.settle();
		expect(sends()).toHaveLength(1);
	});

	it('pedido de atendente: pausa o agente e avisa o cliente; depois disso só grava', async () => {
		await deliver(receivedEvent({ text: 'Quero falar com um ATENDENTE, por favor' }));
		await t.settle();
		expect(rows('SELECT bot_paused FROM conversations')[0].bot_paused).toBe(1);
		expect(sends()[0].body.text).toBe(DEFAULT_AGENT.handoff_message);
		expect(t.ai.calls).toHaveLength(0);

		await deliver(receivedEvent({ text: 'Alô?' }));
		await t.settle();
		expect(sends()).toHaveLength(1);
		expect(rows("SELECT COUNT(*) AS n FROM messages WHERE author = 'contact'")[0].n).toBe(2);
	});

	it('foto ou áudio: responde a mensagem configurada, sem chamar o modelo', async () => {
		await deliver(receivedEvent({ type: 'image' }));
		await t.settle();
		expect(sends()[0].body.text).toBe(DEFAULT_AGENT.media_reply);
		expect(t.ai.calls).toHaveLength(0);
	});

	it('agente desligado ou conversa pausada: grava e não responde', async () => {
		await saveAgent(t.env.DB, { enabled: false });
		await deliver(receivedEvent());
		await t.settle();
		expect(sends()).toHaveLength(0);
		expect(rows('SELECT * FROM messages')).toHaveLength(1);
	});

	it('envio recusado pela Atalia fica gravado como falha, com o motivo', async () => {
		vi.stubGlobal('fetch', async () =>
			Response.json({ error: { code: 'WINDOW_CLOSED', message: 'Fora da janela.' } }, { status: 403 }),
		);
		await deliver(receivedEvent());
		await t.settle();
		const [failed] = rows("SELECT status, error FROM messages WHERE author = 'bot'");
		expect(failed).toEqual({ status: 'failed', error: 'WINDOW_CLOSED: Fora da janela.' });
	});

	it('rajada: se outra mensagem chegou enquanto a IA pensava, só a mais nova é respondida', async () => {
		let release;
		const gate = new Promise((resolve) => (release = resolve));
		t.env.AI.run = async () => (await gate, { response: 'Abrimos sim, das 9h às 18h.' });
		const first = receivedEvent({ text: 'Oi' });
		const second = receivedEvent({ text: 'Vocês abrem sábado?' });
		await deliver(first);
		await deliver(second);
		release();
		await t.settle();
		expect(sends()).toHaveLength(1);
		expect(sends()[0].headers['Idempotency-Key']).toBe(`reply-${second.data.message.id}`);
	});
});

describe('eco e status', () => {
	it('resposta pelo app pausa o agente na conversa', async () => {
		await deliver(receivedEvent());
		await t.settle();
		const echo = receivedEvent({ text: 'Oi Maria, aqui é o João da loja' });
		echo.type = 'message.echo';
		echo.data.message.direction = 'outbound';
		await deliver(echo);
		const [conversation] = rows('SELECT bot_paused FROM conversations');
		expect(conversation.bot_paused).toBe(1);
		expect(rows("SELECT text FROM messages WHERE author = 'app'")).toEqual([{ text: 'Oi Maria, aqui é o João da loja' }]);
	});

	it('message.status atualiza a mensagem enviada', async () => {
		await deliver(receivedEvent());
		await t.settle();
		await deliver({ id: 'evt_status', type: 'message.status', data: { message_id: 'msg-out-1', external_id: 'wamid.out', status: 'read', errors: [] } });
		expect(rows("SELECT status, external_id FROM messages WHERE id = 'msg-out-1'")).toEqual([{ status: 'read', external_id: 'wamid.out' }]);
	});
});

describe('painel', () => {
	const admin = (path, init = {}) =>
		worker.fetch(
			new Request(`https://agente.exemplo.workers.dev${path}`, {
				...init,
				headers: { Authorization: `Basic ${btoa('qualquer:senha')}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
			}),
			t.env,
			t.ctx,
		);

	it('pede senha; senha certa abre a página', async () => {
		const res = await worker.fetch(new Request('https://agente.exemplo.workers.dev/'), t.env, t.ctx);
		expect(res.status).toBe(401);
		expect(res.headers.get('WWW-Authenticate')).toContain('Basic');
		expect((await admin('/')).status).toBe(200);
	});

	it('ação sem o header X-Admin é recusada (outro site não consegue disparar)', async () => {
		await deliver(receivedEvent());
		await t.settle();
		expect((await admin('/admin/api/conversations/48213/messages', { method: 'POST', body: '{"text":"oi"}' })).status).toBe(403);
	});

	it('responder pelo painel envia, grava como "human" e pausa o agente', async () => {
		await deliver(receivedEvent());
		await t.settle();
		const res = await admin('/admin/api/conversations/48213/messages', { method: 'POST', headers: { 'X-Admin': '1' }, body: '{"text":"Oi, sou da equipe"}' });
		expect(res.status).toBe(200);
		expect(rows("SELECT text FROM messages WHERE author = 'human'")).toEqual([{ text: 'Oi, sou da equipe' }]);
		expect(rows('SELECT bot_paused FROM conversations')[0].bot_paused).toBe(1);
	});

	it('religar o agente e salvar a configuração', async () => {
		await deliver(receivedEvent());
		await t.settle();
		await setBotPaused(t.env.DB, '48213', true);
		await admin('/admin/api/conversations/48213/bot', { method: 'POST', headers: { 'X-Admin': '1' }, body: '{"paused":false}' });
		expect(rows('SELECT bot_paused FROM conversations')[0].bot_paused).toBe(0);

		const res = await admin('/admin/api/agent', { method: 'PUT', headers: { 'X-Admin': '1' }, body: JSON.stringify({ name: 'Bia', handoff_keywords: 'gerente, humano', history_limit: 999 }) });
		const { agent } = await res.json();
		expect(agent).toMatchObject({ name: 'Bia', handoff_keywords: ['gerente', 'humano'], history_limit: 50 });
	});
});

describe('regras do agente', () => {
	it('palavra para chamar pessoa: inteira, sem acento nem maiúscula', () => {
		expect(wantsHuman('Quero uma PESSOA!', ['pessoa'])).toBe(true);
		expect(wantsHuman('quero um atendênte', ['atendente'])).toBe(true);
		expect(wantsHuman('pessoalmente', ['pessoa'])).toBe(false);
		expect(wantsHuman('', ['pessoa'])).toBe(false);
	});

	it('normaliza a configuração e descarta modelo inválido', () => {
		const agent = normalizeAgent({ model: 'rm -rf /', history_limit: '1', extra: 'x' });
		expect(agent.model).toBe(DEFAULT_AGENT.model);
		expect(agent.history_limit).toBe(2);
		expect(agent).not.toHaveProperty('extra');
	});
});

describe('revenda: retorno da página de conexão e clientes', () => {
	const returnUrl = async ({ status = 'connected', clientId = 'cli-9', ref = 'usuario-8812', channels = 'whatsapp', t = Math.floor(Date.now() / 1000), secret = SECRET } = {}) => {
		const sig = await hmacHex(secret, `${t}.${status}.${clientId}.${ref}.${channels}`);
		const q = new URLSearchParams({ status, t: String(t), sig });
		if (clientId) q.set('client_id', clientId);
		if (ref) q.set('ref', ref);
		if (channels) q.set('channels', channels);
		return `https://agente.exemplo.workers.dev/retorno?${q}`;
	};
	const open = async (url) => worker.fetch(new Request(url), t.env, t.ctx);

	it('retorno assinado: mostra "Tudo certo", grava o retorno e o cliente; recarregar não duplica', async () => {
		const url = await returnUrl();
		const res = await open(url);
		expect(res.status).toBe(200);
		expect(await res.text()).toContain('Tudo certo!');
		await open(url);
		expect(rows('SELECT status, client_id, ref, channels FROM connect_returns')).toEqual([
			{ status: 'connected', client_id: 'cli-9', ref: 'usuario-8812', channels: 'whatsapp' },
		]);
		expect(rows('SELECT id, status, ref FROM clients')).toEqual([{ id: 'cli-9', status: 'connected', ref: 'usuario-8812' }]);
	});

	it('assinatura errada ou retorno velho: 400 e nada gravado; desistência sem cliente ainda vale', async () => {
		expect((await open(await returnUrl({ secret: 'whsec_outro' }))).status).toBe(400);
		expect((await open(await returnUrl({ t: Math.floor(Date.now() / 1000) - 600 }))).status).toBe(400);
		expect(rows('SELECT * FROM connect_returns')).toHaveLength(0);

		const cancelled = await open(await returnUrl({ status: 'cancelled', clientId: '', channels: '' }));
		expect(cancelled.status).toBe(200);
		expect(await cancelled.text()).toContain('Conexão não concluída');
		expect(rows('SELECT * FROM clients')).toHaveLength(0);
	});

	it('client.connected no webhook grava o cliente com o ref e os canais', async () => {
		await deliver({
			id: 'evt_cli',
			type: 'client.connected',
			client_id: 'cli-9',
			channel: null,
			data: { client: { id: 'cli-9', name: 'Clínica', email: 'a@b.com', tax_id: '11222333000181' }, channels: ['whatsapp', 'instagram'], ref: 'usuario-8812' },
		});
		expect(rows('SELECT name, ref, status, channels FROM clients')).toEqual([{ name: 'Clínica', ref: 'usuario-8812', status: 'connected', channels: 'whatsapp,instagram' }]);
	});

	it('painel: gerar link manda o ref para a Atalia e guarda o link', async () => {
		const res = await worker.fetch(
			new Request('https://agente.exemplo.workers.dev/admin/api/clients', {
				method: 'POST',
				headers: { Authorization: `Basic ${btoa('a:senha')}`, 'Content-Type': 'application/json', 'X-Admin': '1' },
				body: JSON.stringify({ name: 'Clínica', email: 'a@b.com', tax_id: '11.222.333/0001-81', ref: 'usuario-8812' }),
			}),
			t.env,
			t.ctx,
		);
		expect(res.status).toBe(200);
		expect((await res.json()).connect_url).toBe('https://conectar.atalia.ai/medagenda?i=abc');
		const call = t.sent.find((s) => s.url.endsWith('/clients'));
		expect(call.body).toEqual({ name: 'Clínica', email: 'a@b.com', tax_id: '11222333000181', ref: 'usuario-8812', send_email: false });
		expect(rows('SELECT id, ref, status, connect_url FROM clients')).toEqual([
			{ id: 'cli-1', ref: 'usuario-8812', status: 'invited', connect_url: 'https://conectar.atalia.ai/medagenda?i=abc' },
		]);
	});
});

