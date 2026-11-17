-- Revenda (modo "Integrar e oferecer aos meus clientes"): clientes que conectam os próprios números
-- pela página de conexão da Atalia, e os retornos da página para este sistema (/retorno).

-- id = client.id da Atalia (vem no client.connected e no retorno)
CREATE TABLE clients (
	id TEXT PRIMARY KEY,
	name TEXT,
	email TEXT,
	tax_id TEXT,
	ref TEXT,
	status TEXT NOT NULL,
	channels TEXT,
	connect_url TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX idx_clients_ref ON clients (ref);

-- Cada volta da página de conexão. `sig` é único: recarregar a página não grava de novo.
CREATE TABLE connect_returns (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	status TEXT NOT NULL,
	client_id TEXT,
	ref TEXT,
	channels TEXT,
	signed_at INTEGER NOT NULL,
	sig TEXT NOT NULL UNIQUE,
	received_at TEXT NOT NULL
);
