-- Conversas recebidas da Atalia. O id é o conversation_id do evento message.received.
CREATE TABLE conversations (
	id TEXT PRIMARY KEY,
	channel_id TEXT NOT NULL,
	channel_type TEXT,
	client_id TEXT,
	contact_name TEXT,
	contact_phone TEXT,
	bot_paused INTEGER NOT NULL DEFAULT 0,
	unread INTEGER NOT NULL DEFAULT 0,
	last_message TEXT,
	last_message_at TEXT,
	created_at TEXT NOT NULL
);

CREATE INDEX idx_conversations_last ON conversations (last_message_at);

-- Mensagens. O id é o da Atalia; envio recusado fica com id local_... e status failed.
-- author: contact (cliente), bot (agente), human (painel deste worker), app (respondida pelo app do WhatsApp/Instagram)
CREATE TABLE messages (
	id TEXT PRIMARY KEY,
	conversation_id TEXT NOT NULL,
	direction TEXT NOT NULL,
	author TEXT NOT NULL,
	type TEXT,
	text TEXT,
	status TEXT,
	error TEXT,
	external_id TEXT,
	created_at TEXT NOT NULL
);

CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at);
CREATE INDEX idx_messages_external ON messages (external_id);

-- Eventos já processados: a Atalia entrega "pelo menos uma vez", o mesmo evt_... pode chegar de novo.
CREATE TABLE events (
	id TEXT PRIMARY KEY,
	type TEXT NOT NULL,
	summary TEXT,
	received_at TEXT NOT NULL
);

CREATE INDEX idx_events_received ON events (received_at);

-- Configuração do agente e diagnósticos (chave/valor em JSON).
CREATE TABLE settings (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL
);
