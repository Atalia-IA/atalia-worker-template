// Só para olhar o painel sem Cloudflare: node test/preview-server.mjs (porta 8798, senha "senha").
import http from 'node:http';
import worker from '../src/index.js';
import { receivedEvent, signedRequest, testEnv } from './helpers.js';

const t = testEnv();
globalThis.fetch = t.fetchMock;
const deliver = async (event) => worker.fetch(await signedRequest(event), t.env, t.ctx);
await deliver(receivedEvent({ text: 'Oi, vocês entregam hoje?' }));
await t.settle();
await deliver(receivedEvent({ text: 'E aceitam Pix?' }));
await t.settle();
await deliver(receivedEvent({ conversationId: '48214', text: 'Quero falar com um atendente' }));
await t.settle();
await deliver({ id: 'evt_ping', type: 'ping', data: {} });

http
	.createServer(async (req, res) => {
		const chunks = [];
		for await (const c of req) chunks.push(c);
		const request = new Request(`http://localhost:8798${req.url}`, { method: req.method, headers: req.headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
		const response = await worker.fetch(request, t.env, t.ctx);
		res.writeHead(response.status, Object.fromEntries(response.headers));
		res.end(Buffer.from(await response.arrayBuffer()));
	})
	.listen(8798, () => console.log('http://localhost:8798'));
