// Painel com dados de demonstração, sem Cloudflare: npm run preview (porta 8798, senha "senha").
// Contatos e números são fictícios. É daqui que saem os prints do README e da documentação.
import http from 'node:http';
import worker from '../src/index.js';
import { signedRequest, testEnv } from './helpers.js';

const t = testEnv();
const port = Number(process.env.PORT || 8798);

// Respostas do agente de mentira, pela pergunta
const ANSWERS = [
	[/pix|pagamento|cart/i, 'Aceitamos Pix, cartão de crédito e dinheiro na entrega.'],
	[/entreg/i, 'Oi, Maria! Entregamos sim. Pedidos feitos até as 15h saem no mesmo dia para o centro.'],
	[/s[aá]bado|hor[aá]rio/i, 'Aos sábados abrimos das 9h às 18h. Posso ajudar com mais alguma coisa?'],
];
t.env.AI.run = async (_model, { messages }) => {
	const last = messages.at(-1)?.content || '';
	return { response: ANSWERS.find(([re]) => re.test(last))?.[1] || 'Claro! Me conta um pouco mais do que você precisa?' };
};

// A "Atalia" de mentira: canais, envio e teste do webhook
const CHANNELS = [
	{ id: 'ch_2f81a9c0d1', type: 'whatsapp', name: 'Loja Exemplo', status: 'active', phone: '+55 11 4000-1234', client_id: null },
	{ id: 'ch_7b3e10aa42', type: 'instagram', name: 'Loja Exemplo', username: 'lojaexemplo', status: 'active', client_id: null },
];
let sent = 0;
globalThis.fetch = async (url, init = {}) => {
	const path = new URL(String(url)).pathname;
	if (path.endsWith('/channels')) return Response.json({ data: CHANNELS });
	if (path.endsWith('/webhook/test')) return Response.json({ data: { delivered: true, event_id: 'evt_ping', http_status: 200, duration_ms: 182, error: null } });
	if (path.endsWith('/clients')) {
		const body = JSON.parse(init.body);
		const id = `c${Date.now().toString(16)}`;
		return Response.json(
			{ data: { client: { id, name: body.name, email: body.email, tax_id: body.tax_id || null, ref: body.ref || null, status: 'invited' }, connect_url: `https://conectar.atalia.ai/loja-exemplo?i=${id}0f3a9c`, email_sent: false } },
			{ status: 201 },
		);
	}
	if (path.endsWith('/messages')) {
		sent += 1;
		const body = JSON.parse(init.body);
		return Response.json({ data: { id: `msg-out-${sent}`, status: 'pending', conversation_id: body.conversation_id } }, { status: 202 });
	}
	return Response.json({ error: { code: 'NOT_FOUND', message: 'Não encontrado.' } }, { status: 404 });
};

let seq = 0;
const deliver = async (event) => {
	await worker.fetch(await signedRequest(event), t.env, t.ctx);
	await t.settle();
};
const channels = { whatsapp: CHANNELS[0], instagram: CHANNELS[1] };
function inbound(conversationId, contact, text, { channel = 'whatsapp', type = 'text' } = {}) {
	seq += 1;
	const ch = channels[channel];
	return {
		id: `evt_demo_${seq}`,
		type: 'message.received',
		created_at: new Date().toISOString(),
		client_id: null,
		channel: { id: ch.id, type: ch.type, phone: ch.phone || null },
		data: {
			conversation_id: conversationId,
			message: { id: `msg-in-${seq}`, external_id: `wamid.${seq}`, direction: 'inbound', type, text: type === 'text' ? text : null, media: null, status: 'received', contact },
		},
	};
}
const status = (messageId, value) => ({ id: `evt_status_${messageId}_${value}`, type: 'message.status', data: { message_id: messageId, status: value, errors: [] } });
const admin = (path, body) =>
	worker.fetch(
		new Request(`http://localhost${path}`, {
			method: 'POST',
			headers: { Authorization: `Basic ${btoa('demo:senha')}`, 'Content-Type': 'application/json', 'X-Admin': '1' },
			body: JSON.stringify(body),
		}),
		t.env,
		t.ctx,
	);

const carlos = { name: 'Carlos Mendes', phone: '+5511955554444' };
const ana = { name: 'Ana Lima', phone: null };
const joao = { name: 'João Pedro', phone: '+5511977776666' };
const maria = { name: 'Maria Souza', phone: '+5511988887777' };

await deliver(inbound('48210', carlos, null, { type: 'image' }));
await deliver(inbound('48211', ana, 'Qual o horário de vocês no sábado?', { channel: 'instagram' }));
await deliver(status('msg-out-2', 'read'));
await deliver(inbound('48212', joao, 'Quero falar com um atendente, por favor'));
await admin('/admin/api/conversations/48212/messages', { text: 'Oi, João! Aqui é a Carla, da loja. Como posso ajudar?' });
await deliver(inbound('48213', maria, 'Oi! Vocês entregam no centro hoje?'));
await deliver(status('msg-out-5', 'read'));
await deliver(inbound('48213', maria, 'E aceitam Pix?'));
await deliver(status('msg-out-6', 'delivered'));
await deliver({ id: 'evt_ping', type: 'ping', data: {} });

// Revenda: um cliente que concluiu (evento + retorno) e um que ficou sem vaga
const clinica = { id: 'c21a7f0e-2b4d-4e8a-9f1c-0d2e3f4a5b6c', name: 'Clínica Bem-Estar', email: 'contato@clinicabemestar.com.br', tax_id: '11222333000181' };
await deliver({ id: 'evt_cli_1', type: 'client.connected', client_id: clinica.id, channel: null, data: { client: clinica, channels: ['whatsapp'], ref: 'usuario-8812' } });
const padaria = { id: 'b7e2c1d0-9a8b-4c3d-8e7f-6a5b4c3d2e1f', name: 'Padaria Pão Quente', email: 'pao@padaria.com.br', tax_id: '22333444000155' };
await deliver({ id: 'evt_cli_2', type: 'client.no_slot', client_id: padaria.id, channel: null, data: { client: padaria, ref: 'usuario-9120' } });
{
	const { hmacHex } = await import('../src/atalia.js');
	const ts = Math.floor(Date.now() / 1000);
	const sig = await hmacHex(t.env.ATALIA_WEBHOOK_SECRET, `${ts}.connected.${clinica.id}.usuario-8812.whatsapp`);
	await worker.fetch(
		new Request(`http://localhost/retorno?status=connected&client_id=${clinica.id}&ref=usuario-8812&channels=whatsapp&t=${ts}&sig=${sig}`),
		t.env,
		t.ctx,
	);
}

http
	.createServer(async (req, res) => {
		const chunks = [];
		for await (const chunk of req) chunks.push(chunk);
		// Endereço de um worker publicado, para o painel mostrar o webhook como ele aparece de verdade
		const request = new Request(`https://atalia-agente-exemplo.loja-exemplo.workers.dev${req.url}`, {
			method: req.method,
			headers: req.headers,
			body: chunks.length ? Buffer.concat(chunks) : undefined,
		});
		const response = await worker.fetch(request, t.env, t.ctx);
		res.writeHead(response.status, Object.fromEntries(response.headers));
		res.end(Buffer.from(await response.arrayBuffer()));
	})
	.listen(port, () => console.log(`http://localhost:${port} (senha: senha)`));
