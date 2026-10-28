/**
 * Gerenciador de conversas: tudo o que este exemplo guarda no D1 (ver migrations/0001_inicial.sql).
 */
import { DEFAULT_AGENT, normalizeAgent } from './agent.js';

export const nowIso = () => new Date().toISOString();

// ---- Eventos (deduplicação) ----

/** Marca o evento como recebido. false = já tinha chegado antes (a Atalia pode reenviar o mesmo evt_...). */
export async function claimEvent(db, event, summary) {
	const result = await db
		.prepare('INSERT OR IGNORE INTO events (id, type, summary, received_at) VALUES (?, ?, ?, ?)')
		.bind(event.id, event.type, summary ?? null, nowIso())
		.run();
	return result.meta.changes > 0;
}

/** Desfaz a marca quando o processamento falhou, para a nova tentativa da Atalia ser processada. */
export async function releaseEvent(db, eventId) {
	await db.prepare('DELETE FROM events WHERE id = ?').bind(eventId).run();
}

export async function recentEvents(db, limit = 15) {
	const { results } = await db.prepare('SELECT id, type, summary, received_at FROM events ORDER BY received_at DESC LIMIT ?').bind(limit).all();
	return results;
}

// ---- Conversas ----

export async function upsertConversation(db, { id, channel, clientId, contact }) {
	await db
		.prepare(
			`INSERT INTO conversations (id, channel_id, channel_type, client_id, contact_name, contact_phone, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
			   contact_name = COALESCE(excluded.contact_name, conversations.contact_name),
			   contact_phone = COALESCE(excluded.contact_phone, conversations.contact_phone)`,
		)
		.bind(String(id), channel?.id ?? '', channel?.type ?? null, clientId ?? null, contact?.name ?? null, contact?.phone ?? null, nowIso())
		.run();
}

export async function getConversation(db, id) {
	return db.prepare('SELECT * FROM conversations WHERE id = ?').bind(String(id)).first();
}

export async function listConversations(db, limit = 100) {
	const { results } = await db
		.prepare('SELECT * FROM conversations ORDER BY COALESCE(last_message_at, created_at) DESC LIMIT ?')
		.bind(limit)
		.all();
	return results;
}

export async function setBotPaused(db, id, paused) {
	await db.prepare('UPDATE conversations SET bot_paused = ? WHERE id = ?').bind(paused ? 1 : 0, String(id)).run();
}

export async function markRead(db, id) {
	await db.prepare('UPDATE conversations SET unread = 0 WHERE id = ?').bind(String(id)).run();
}

// ---- Mensagens ----

/** Grava a mensagem (idempotente pelo id) e atualiza a prévia da conversa. false = já existia. */
export async function addMessage(db, message) {
	const createdAt = message.createdAt ?? nowIso();
	const result = await db
		.prepare(
			`INSERT OR IGNORE INTO messages (id, conversation_id, direction, author, type, text, status, error, external_id, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			message.id,
			String(message.conversationId),
			message.direction,
			message.author,
			message.type ?? 'text',
			message.text ?? null,
			message.status ?? null,
			message.error ?? null,
			message.externalId ?? null,
			createdAt,
		)
		.run();
	if (!result.meta.changes) return false;
	await db
		.prepare('UPDATE conversations SET last_message = ?, last_message_at = ?, unread = unread + ? WHERE id = ?')
		.bind(preview(message), createdAt, message.direction === 'inbound' ? 1 : 0, String(message.conversationId))
		.run();
	return true;
}

function preview(message) {
	if (message.status === 'failed') return `Não enviada: ${message.error || 'erro'}`.slice(0, 200);
	return (message.text || `[${message.type || 'mensagem'}]`).slice(0, 200);
}

export async function messageExists(db, { id, externalId }) {
	const row = await db
		.prepare('SELECT id FROM messages WHERE id = ? OR (external_id IS NOT NULL AND external_id = ?) LIMIT 1')
		.bind(id ?? '', externalId ?? '')
		.first();
	return !!row;
}

export async function updateMessageStatus(db, { id, status, externalId, error }) {
	await db
		.prepare('UPDATE messages SET status = ?, external_id = COALESCE(?, external_id), error = COALESCE(?, error) WHERE id = ?')
		.bind(status, externalId ?? null, error ?? null, id)
		.run();
}

export async function listMessages(db, conversationId, limit = 200) {
	const { results } = await db
		.prepare(
			'SELECT * FROM (SELECT *, rowid AS seq FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?) ORDER BY created_at ASC, seq ASC',
		)
		.bind(String(conversationId), limit)
		.all();
	return results;
}

/** Histórico para o modelo: só mensagens com texto que de fato foram (ou vieram). */
export async function recentHistory(db, conversationId, limit) {
	const { results } = await db
		.prepare(
			`SELECT * FROM (
			   SELECT author, text, created_at, rowid AS seq FROM messages
			   WHERE conversation_id = ? AND text IS NOT NULL AND COALESCE(status, '') <> 'failed'
			   ORDER BY created_at DESC, rowid DESC LIMIT ?
			 ) ORDER BY created_at ASC, seq ASC`,
		)
		.bind(String(conversationId), limit)
		.all();
	return results;
}

export async function latestInboundId(db, conversationId) {
	const row = await db
		.prepare("SELECT id FROM messages WHERE conversation_id = ? AND direction = 'inbound' ORDER BY created_at DESC, rowid DESC LIMIT 1")
		.bind(String(conversationId))
		.first();
	return row?.id ?? null;
}

// ---- Configuração ----

async function getSetting(db, key) {
	const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
	if (!row) return null;
	try {
		return JSON.parse(row.value);
	} catch {
		return null;
	}
}

async function setSetting(db, key, value) {
	await db
		.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
		.bind(key, JSON.stringify(value))
		.run();
}

export async function getAgent(db) {
	return normalizeAgent((await getSetting(db, 'agent')) ?? DEFAULT_AGENT);
}

export async function saveAgent(db, input) {
	const agent = normalizeAgent(input, await getAgent(db));
	await setSetting(db, 'agent', agent);
	return agent;
}

/** Último evento recusado (assinatura errada etc.): aparece na aba Conexão para ajudar no teste. */
export async function noteRejection(db, reason) {
	await setSetting(db, 'last_rejection', { reason, at: nowIso() });
}

export const lastRejection = (db) => getSetting(db, 'last_rejection');
