/**
 * D1 de mentira sobre o SQLite do Node (node:sqlite), com a migration de verdade, e eventos assinados
 * como a Atalia assina.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { hmacHex } from '../src/atalia.js';

export function fakeD1() {
	const sqlite = new DatabaseSync(':memory:');
	const dir = new URL('../migrations/', import.meta.url);
	for (const file of readdirSync(dir).sort()) sqlite.exec(readFileSync(new URL(file, dir), 'utf8'));

	const plain = (row) => (row ? { ...row } : null);
	return {
		sqlite,
		prepare(sql) {
			let args = [];
			const statement = {
				bind(...values) {
					if (values.some((v) => v === undefined)) throw new Error(`D1 não aceita undefined: ${sql}`);
					args = values;
					return statement;
				},
				async first() {
					return plain(sqlite.prepare(sql).get(...args));
				},
				async all() {
					return { results: sqlite.prepare(sql).all(...args).map(plain) };
				},
				async run() {
					const result = sqlite.prepare(sql).run(...args);
					return { meta: { changes: Number(result.changes) } };
				},
			};
			return statement;
		},
	};
}

export const SECRET = 'whsec_teste123';

export async function signedRequest(event, { secret = SECRET, timestamp = Math.floor(Date.now() / 1000) } = {}) {
	const body = JSON.stringify(event);
	const signature = await hmacHex(secret, `${timestamp}.${body}`);
	return new Request('https://agente.exemplo.workers.dev/webhook', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-Atalia-Signature': `t=${timestamp},v1=${signature}` },
		body,
	});
}

let seq = 0;
export function receivedEvent({ text = 'Oi, vocês entregam hoje?', conversationId = '48213', type = 'text', id } = {}) {
	seq += 1;
	return {
		id: id || `evt_${seq}`,
		type: 'message.received',
		created_at: new Date().toISOString(),
		company_id: 'c0a8',
		client_id: null,
		channel: { id: 'ch_2f81a9c0d1', type: 'whatsapp', phone: '+55 11 98765-4321' },
		data: {
			conversation_id: conversationId,
			message: {
				id: `msg-in-${seq}`,
				external_id: `wamid.${seq}`,
				direction: 'inbound',
				type,
				text: type === 'text' ? text : null,
				media: null,
				status: 'received',
				contact: { name: 'Maria', phone: '+5511912345678' },
				created_at: '2026-10-28 14:02:11',
			},
		},
	};
}

/** env + ctx do worker, com a Atalia e o modelo de mentira. */
export function testEnv({ reply = 'Entregamos sim, em até 2 dias úteis!' } = {}) {
	const sent = [];
	const waits = [];
	let n = 0;
	const fetchMock = async (url, init) => {
		const body = init?.body ? JSON.parse(init.body) : null;
		sent.push({ url: String(url), method: init?.method, headers: init?.headers, body });
		if (String(url).endsWith('/messages')) {
			n += 1;
			return Response.json({ data: { id: `msg-out-${n}`, status: 'pending', conversation_id: body.conversation_id } }, { status: 202 });
		}
		return Response.json({ data: [] });
	};
	const ai = { calls: [], run: async (model, input) => (ai.calls.push({ model, input }), { response: reply }) };
	const env = {
		DB: fakeD1(),
		AI: ai,
		ATALIA_API_KEY: 'atk_live_teste',
		ATALIA_WEBHOOK_SECRET: SECRET,
		ADMIN_PASSWORD: 'senha',
	};
	const ctx = { waitUntil: (p) => waits.push(p) };
	return { env, ctx, sent, ai, fetchMock, settle: () => Promise.all(waits.splice(0)) };
}
