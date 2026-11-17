/**
 * Página do painel (HTML, CSS e JS num arquivo só, sem dependências). Servida em GET / depois da senha.
 * Todo texto que vem do banco entra por textContent, nunca por innerHTML.
 */
export const ADMIN_HTML = /* html */ `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agente de exemplo · Atalia</title>
<link rel="icon" href="data:,">
<style>
:root {
	--bg: #f4f5f9; --surface: #ffffff; --surface-2: #f0f2f8; --line: #dfe2ea; --text: #141a33; --muted: #5d6380;
	--primary: #1036f2; --primary-text: #ffffff; --tint: #e8edff; --tint-text: #1036f2;
	--ok: #0f7a4f; --ok-bg: #e3f5ec; --warn: #8a5a00; --warn-bg: #fdf1d8; --danger: #b42318; --danger-bg: #fde8e7;
	--bubble-in: #ffffff; --bubble-out: #e8edff;
	color-scheme: light;
}
@media (prefers-color-scheme: dark) {
	:root {
		--bg: #0e1222; --surface: #161b2e; --surface-2: #1d2338; --line: #2a3150; --text: #e8eaf4; --muted: #9aa1bf;
		--primary: #5b78ff; --primary-text: #ffffff; --tint: #1f2a55; --tint-text: #a9b8ff;
		--ok: #5fd39c; --ok-bg: #12372a; --warn: #f2c26b; --warn-bg: #3a2e12; --danger: #ff8a80; --danger-bg: #3d1b1b;
		--bubble-in: #1d2338; --bubble-out: #1f2a55;
		color-scheme: dark;
	}
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
button, input, textarea, select { font: inherit; color: inherit; }
button { cursor: pointer; }
.top { display: flex; align-items: center; gap: 24px; padding: 0 20px; height: 56px; background: var(--surface); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 2; }
.brand { font-weight: 700; white-space: nowrap; }
.brand small { font-weight: 500; color: var(--muted); }
.tabs { display: flex; gap: 4px; height: 100%; }
.tab { border: none; border-radius: 0; background: none; padding: 0 12px; color: var(--muted); font-weight: 600; border-bottom: 2px solid transparent; }
.tab[aria-selected="true"] { color: var(--text); border-bottom-color: var(--primary); }
main { padding: 20px; max-width: 1200px; margin: 0 auto; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
.btn { border: 1px solid var(--line); background: var(--surface); border-radius: 8px; padding: 8px 14px; font-weight: 600; }
.btn:hover { background: var(--surface-2); }
.btn-primary { background: var(--primary); border-color: var(--primary); color: var(--primary-text); }
.btn-primary:hover { background: var(--primary); filter: brightness(1.08); }
.btn:disabled { opacity: .6; cursor: default; }
.muted { color: var(--muted); }
.pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--surface-2); color: var(--muted); white-space: nowrap; }
.pill-ok { background: var(--ok-bg); color: var(--ok); }
.pill-warn { background: var(--warn-bg); color: var(--warn); }
.pill-danger { background: var(--danger-bg); color: var(--danger); }
.pill-primary { background: var(--primary); color: var(--primary-text); }
.empty { padding: 48px 24px; text-align: center; color: var(--muted); }
code, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }

/* Conversas */
.inbox { display: grid; grid-template-columns: 320px 1fr; height: calc(100vh - 96px); overflow: hidden; }
.list { border-right: 1px solid var(--line); overflow-y: auto; }
.conv { display: flex; gap: 10px; width: 100%; padding: 12px 14px; border: none; border-radius: 0; background: none; text-align: left; border-bottom: 1px solid var(--line); }
.conv:hover, .conv[aria-current="true"] { background: var(--surface-2); }
.avatar { flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: var(--tint); color: var(--tint-text); font-weight: 700; font-size: 13px; }
.conv-body { min-width: 0; flex: 1; }
.conv-line { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
.conv-name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conv-preview { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.thread { display: flex; flex-direction: column; min-width: 0; }
.thread-head { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
.thread-head .grow { flex: 1; min-width: 0; }
.back { display: none; }
.messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; background: var(--bg); }
.msg { max-width: 72%; padding: 8px 12px; border-radius: 12px; background: var(--bubble-in); border: 1px solid var(--line); white-space: pre-wrap; overflow-wrap: anywhere; }
.msg.out { align-self: flex-end; background: var(--bubble-out); }
.msg.failed { border-color: var(--danger); }
.msg-meta { font-size: 11.5px; color: var(--muted); margin-bottom: 2px; display: flex; gap: 6px; }
.msg-error { color: var(--danger); font-size: 12.5px; margin-top: 4px; }
.composer { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--line); }
.composer textarea { flex: 1; resize: none; min-height: 42px; max-height: 140px; field-sizing: content; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); line-height: 20px; overflow-y: auto; }
.switch { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; white-space: nowrap; }
.switch input { width: 16px; height: 16px; accent-color: var(--primary); }

/* Formulários */
.section { padding: 20px 24px; border-bottom: 1px solid var(--line); }
.section:last-child { border-bottom: none; }
.section h2 { margin: 0 0 4px; font-size: 16px; }
.section h3 { margin: 16px 0 4px; font-size: 14px; }
.field { display: grid; grid-template-columns: 240px 1fr; gap: 16px; padding: 12px 0; align-items: start; }
.field label { font-weight: 600; padding-top: 8px; }
.field .hint { display: block; font-weight: 400; color: var(--muted); font-size: 12.5px; margin-top: 2px; }
.field input[type=text], .field input[type=number], .field textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
.field textarea { min-height: 150px; resize: vertical; }
.actions { display: flex; gap: 8px; justify-content: flex-end; padding: 16px 24px; }

/* Conexão */
.steps { display: grid; gap: 12px; }
.step { display: grid; grid-template-columns: 28px 1fr; gap: 12px; padding: 16px 20px; }
.step-n { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--surface-2); font-weight: 700; }
.step-n.ok { background: var(--ok-bg); color: var(--ok); }
.step h3 { margin: 2px 0 6px; font-size: 15px; }
.copy-row { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
.copy-row code { flex: 1; min-width: 0; padding: 8px 10px; background: var(--surface-2); border-radius: 8px; overflow-wrap: anywhere; }
.client-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; margin-top: 12px; }
.client-form input[type=text], .client-form input[type=email] { width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); }
.client-form .full { grid-column: 1 / -1; }
.client-form label { display: grid; gap: 4px; font-size: 13px; font-weight: 600; }
.client-form .switch { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.table-wrap { overflow-x: auto; }
.alert { padding: 12px 16px; border-radius: 10px; background: var(--warn-bg); color: var(--warn); margin-bottom: 12px; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--muted); font-weight: 600; font-size: 12.5px; }
.toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--text); color: var(--bg); padding: 10px 16px; border-radius: 10px; font-weight: 600; opacity: 0; transition: opacity .2s; pointer-events: none; }
.toast.show { opacity: 1; }

@media (max-width: 760px) {
	.top { gap: 12px; padding: 0 16px; }
	.brand { display: none; }
	main { padding: 12px 16px; }
	.inbox { grid-template-columns: 1fr; height: calc(100vh - 80px); }
	.inbox .thread { display: none; }
	.inbox.open .list { display: none; }
	.inbox.open .thread { display: flex; }
	.back { display: inline-flex; }
	.msg { max-width: 88%; }
	.field { grid-template-columns: 1fr; gap: 4px; }
	.field label { padding-top: 0; }
	.hide-sm { display: none; }
	.client-form { grid-template-columns: 1fr; }
}
</style>
</head>
<body>
<header class="top">
	<div class="brand">Agente de exemplo <small>· Atalia</small></div>
	<nav class="tabs" role="tablist">
		<button class="tab" role="tab" data-tab="inbox" aria-selected="true">Conversas</button>
		<button class="tab" role="tab" data-tab="agent">Agente</button>
		<button class="tab" role="tab" data-tab="clients">Clientes</button>
		<button class="tab" role="tab" data-tab="connection">Conexão</button>
	</nav>
</header>
<main>
	<section data-panel="inbox">
		<div class="card inbox" id="inbox">
			<div class="list" id="list"><div class="empty">Carregando…</div></div>
			<div class="thread" id="thread"><div class="empty">Escolha uma conversa.</div></div>
		</div>
	</section>
	<section data-panel="agent" hidden>
		<form class="card" id="agent-form"></form>
	</section>
	<section data-panel="clients" hidden>
		<div id="clients"><div class="empty">Carregando…</div></div>
	</section>
	<section data-panel="connection" hidden>
		<div id="connection"><div class="empty">Carregando…</div></div>
	</section>
</main>
<div class="toast" id="toast" role="status"></div>
<script>
(() => {
	'use strict';

	// ---------- utilidades ----------
	function el(tag, props, ...children) {
		const node = document.createElement(tag);
		for (const [key, value] of Object.entries(props || {})) {
			if (value === null || value === undefined || value === false) continue;
			if (key === 'class') node.className = value;
			else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
			else if (key === 'text') node.textContent = value;
			else node.setAttribute(key, value === true ? '' : value);
		}
		for (const child of children.flat()) if (child !== null && child !== undefined && child !== false) node.append(child);
		return node;
	}

	async function api(path, options = {}) {
		const res = await fetch('/admin/api' + path, {
			...options,
			headers: { 'Content-Type': 'application/json', 'X-Admin': '1', ...(options.headers || {}) },
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.error || 'Erro ' + res.status);
		return data;
	}

	let toastTimer;
	function toast(text) {
		const node = document.getElementById('toast');
		node.textContent = text;
		node.classList.add('show');
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => node.classList.remove('show'), 2600);
	}

	const initials = (name) => (name || '?').trim().split(/\\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
	const time = (iso) => {
		if (!iso) return '';
		const d = new Date(iso);
		const today = new Date().toDateString() === d.toDateString();
		return today ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
	};
	const AUTHORS = { contact: 'Cliente', bot: 'Agente', human: 'Você (painel)', app: 'Pelo app' };
	const STATUS = { pending: 'na fila', sent: 'enviada', delivered: 'entregue', read: 'lida', failed: 'não enviada' };
	const CHANNEL_TYPES = { whatsapp: 'WhatsApp', whatsapp_web: 'WhatsApp (QR Code)', instagram: 'Instagram', messenger: 'Messenger' };
	const CHANNEL_STATUS = { active: 'Conectado', inactive: 'Desligado', disconnected: 'Desconectado', pending: 'Pendente' };
	const channelType = (type) => CHANNEL_TYPES[type] || type || '';

	// ---------- abas ----------
	let currentTab = 'inbox';
	document.querySelectorAll('.tab').forEach((tab) =>
		tab.addEventListener('click', () => {
			currentTab = tab.dataset.tab;
			document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
			document.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== currentTab));
			if (currentTab === 'inbox') loadList();
			if (currentTab === 'agent') loadAgent();
			if (currentTab === 'clients') loadClients();
			if (currentTab === 'connection') loadConnection();
		}),
	);

	// ---------- conversas ----------
	let openId = null;
	let lastThreadKey = '';

	async function loadList() {
		const list = document.getElementById('list');
		try {
			const { conversations } = await api('/conversations');
			if (!conversations.length) {
				list.replaceChildren(el('div', { class: 'empty' }, 'Nenhuma conversa ainda.', el('br'), 'Mande uma mensagem para o número conectado na Atalia.'));
				return;
			}
			list.replaceChildren(
				...conversations.map((c) =>
					el(
						'button',
						{ class: 'conv', 'aria-current': String(c.id === openId), onclick: () => openConversation(c.id) },
						el('span', { class: 'avatar', text: initials(c.contact_name || c.contact_phone) }),
						el(
							'span',
							{ class: 'conv-body' },
							el('span', { class: 'conv-line' }, el('span', { class: 'conv-name', text: c.contact_name || c.contact_phone || 'Contato' }), el('span', { class: 'muted', text: time(c.last_message_at) })),
							el(
								'span',
								{ class: 'conv-line' },
								el('span', { class: 'conv-preview', text: c.last_message || '' }),
								c.bot_paused ? el('span', { class: 'pill pill-warn', text: 'Pessoa' }) : null,
								c.unread ? el('span', { class: 'pill pill-primary', text: String(c.unread) }) : null,
							),
						),
					),
				),
			);
		} catch (error) {
			list.replaceChildren(el('div', { class: 'empty', text: error.message }));
		}
	}

	async function openConversation(id) {
		openId = id;
		lastThreadKey = '';
		document.getElementById('inbox').classList.add('open');
		await loadThread();
		loadList();
	}

	async function loadThread() {
		if (!openId) return;
		const thread = document.getElementById('thread');
		let data;
		try {
			data = await api('/conversations/' + encodeURIComponent(openId));
		} catch (error) {
			thread.replaceChildren(el('div', { class: 'empty', text: error.message }));
			return;
		}
		const { conversation: c, messages } = data;
		const key = c.bot_paused + '|' + messages.map((m) => m.id + m.status).join(',');
		if (key === lastThreadKey) return;
		lastThreadKey = key;

		const draft = thread.querySelector('textarea')?.value || '';
		const toggle = el('input', { type: 'checkbox', checked: !c.bot_paused });
		toggle.addEventListener('change', async () => {
			try {
				await api('/conversations/' + encodeURIComponent(c.id) + '/bot', { method: 'POST', body: JSON.stringify({ paused: !toggle.checked }) });
				toast(toggle.checked ? 'O agente voltou a responder.' : 'Agente pausado: só você responde.');
				lastThreadKey = '';
				loadThread();
				loadList();
			} catch (error) {
				toast(error.message);
			}
		});

		const list = el(
			'div',
			{ class: 'messages' },
			messages.length
				? messages.map((m) =>
						el(
							'div',
							{ class: 'msg' + (m.direction === 'outbound' ? ' out' : '') + (m.status === 'failed' ? ' failed' : '') },
							el('div', { class: 'msg-meta' }, el('span', { text: AUTHORS[m.author] || m.author }), el('span', { text: time(m.created_at) }), m.direction === 'outbound' && m.status ? el('span', { text: STATUS[m.status] || m.status }) : null),
							el('div', { text: m.text || '[' + (m.type || 'mídia') + ']' }),
							m.error ? el('div', { class: 'msg-error', text: m.error }) : null,
						),
					)
				: el('div', { class: 'empty', text: 'Sem mensagens.' }),
		);

		const input = el('textarea', { placeholder: 'Responder como pessoa da equipe…', rows: '1' });
		input.value = draft;
		const send = el('button', { class: 'btn btn-primary', type: 'submit', text: 'Enviar' });
		const form = el('form', { class: 'composer' }, input, send);
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			const text = input.value.trim();
			if (!text) return;
			send.disabled = true;
			try {
				await api('/conversations/' + encodeURIComponent(c.id) + '/messages', { method: 'POST', body: JSON.stringify({ text }) });
				input.value = '';
			} catch (error) {
				toast(error.message);
			} finally {
				send.disabled = false;
				lastThreadKey = '';
				loadThread();
				loadList();
			}
		});
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				form.requestSubmit();
			}
		});

		thread.replaceChildren(
			el(
				'div',
				{ class: 'thread-head' },
				el('button', { class: 'btn back', type: 'button', text: 'Voltar', onclick: () => { openId = null; document.getElementById('inbox').classList.remove('open'); loadList(); } }),
				el('span', { class: 'avatar', text: initials(c.contact_name || c.contact_phone) }),
				el('div', { class: 'grow' }, el('div', { class: 'conv-name', text: c.contact_name || 'Contato' }), el('div', { class: 'muted mono', text: [c.contact_phone, channelType(c.channel_type), c.channel_id].filter(Boolean).join(' · ') })),
				el('label', { class: 'switch' }, toggle, el('span', { class: 'hide-sm', text: 'Agente responde' })),
			),
			list,
			form,
		);
		list.scrollTop = list.scrollHeight;
	}

	// ---------- agente ----------
	const AGENT_FIELDS = [
		{ key: 'enabled', label: 'Agente ligado', hint: 'Desligado, as mensagens só ficam gravadas aqui.', type: 'checkbox' },
		{ key: 'name', label: 'Nome', type: 'text' },
		{ key: 'instructions', label: 'Instruções', hint: 'Quem o agente é, o que sabe sobre a empresa e o que não pode fazer.', type: 'textarea' },
		{ key: 'model', label: 'Modelo', hint: '@cf/... roda no Workers AI. gpt-... precisa do segredo OPENAI_API_KEY.', type: 'text', list: ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-4-scout-17b-16e-instruct', 'gpt-4.1-mini'] },
		{ key: 'history_limit', label: 'Mensagens no histórico', hint: 'Quantas mensagens anteriores o agente lê (2 a 50).', type: 'number' },
		{ key: 'handoff_keywords', label: 'Palavras para chamar uma pessoa', hint: 'Separadas por vírgula. O agente pausa na conversa e avisa o cliente.', type: 'text' },
		{ key: 'handoff_message', label: 'Mensagem ao chamar uma pessoa', type: 'text' },
		{ key: 'media_reply', label: 'Resposta para foto, áudio ou arquivo', hint: 'Em branco, não responde.', type: 'text' },
		{ key: 'pause_on_human_reply', label: 'Pausar quando alguém da equipe responder', hint: 'Pelo painel ou pelo app do WhatsApp Business/Instagram.', type: 'checkbox' },
	];

	async function loadAgent() {
		const form = document.getElementById('agent-form');
		let data;
		try {
			data = await api('/agent');
		} catch (error) {
			form.replaceChildren(el('div', { class: 'empty', text: error.message }));
			return;
		}
		const inputs = {};
		const fill = (agent) => {
			for (const f of AGENT_FIELDS) {
				const value = agent[f.key];
				if (f.type === 'checkbox') inputs[f.key].checked = !!value;
				else inputs[f.key].value = Array.isArray(value) ? value.join(', ') : value ?? '';
			}
		};
		const rows = AGENT_FIELDS.map((f) => {
			const id = 'agent-' + f.key;
			let input;
			if (f.type === 'textarea') input = el('textarea', { id });
			else if (f.type === 'checkbox') input = el('input', { id, type: 'checkbox' });
			else input = el('input', { id, type: f.type, list: f.list ? id + '-list' : null, min: f.type === 'number' ? '2' : null, max: f.type === 'number' ? '50' : null });
			inputs[f.key] = input;
			return el(
				'div',
				{ class: 'field' },
				el('label', { for: id }, f.label, f.hint ? el('span', { class: 'hint', text: f.hint }) : null),
				el('div', {}, f.type === 'checkbox' ? el('label', { class: 'switch' }, input, el('span', { text: 'Sim' })) : input, f.list ? el('datalist', { id: id + '-list' }, f.list.map((v) => el('option', { value: v }))) : null),
			);
		});
		const save = el('button', { class: 'btn btn-primary', type: 'submit', text: 'Salvar' });
		form.replaceChildren(
			el('div', { class: 'section' }, el('h2', { text: 'Agente' }), el('div', { class: 'muted', text: 'Vale para a próxima mensagem que chegar.' }), rows),
			el('div', { class: 'actions' }, el('button', { class: 'btn', type: 'button', text: 'Restaurar padrão', onclick: () => fill(data.defaults) }), save),
		);
		fill(data.agent);
		form.onsubmit = async (e) => {
			e.preventDefault();
			const body = {};
			for (const f of AGENT_FIELDS) body[f.key] = f.type === 'checkbox' ? inputs[f.key].checked : inputs[f.key].value;
			save.disabled = true;
			try {
				const { agent } = await api('/agent', { method: 'PUT', body: JSON.stringify(body) });
				fill(agent);
				toast('Agente salvo.');
			} catch (error) {
				toast(error.message);
			} finally {
				save.disabled = false;
			}
		};
	}

	// ---------- conexão ----------
	async function loadConnection() {
		const box = document.getElementById('connection');
		let s;
		try {
			s = await api('/status');
		} catch (error) {
			box.replaceChildren(el('div', { class: 'empty', text: error.message }));
			return;
		}
		const copyBtn = (value) => el('button', { class: 'btn', type: 'button', text: 'Copiar', onclick: () => navigator.clipboard.writeText(value).then(() => toast('Copiado.')) });
		const step = (n, ok, title, ...body) => el('div', { class: 'card step' }, el('span', { class: 'step-n' + (ok ? ' ok' : ''), text: ok ? '✓' : String(n) }), el('div', {}, el('h3', { text: title }), body));

		const channelsOk = Array.isArray(s.channels) && s.channels.length > 0;
		const secretText = {
			ok: 'Configurado.',
			placeholder: 'Ainda é o valor provisório. Troque pelo segredo whsec_... que aparece na Atalia.',
			missing: 'Não configurado.',
		}[s.webhook_secret];
		const lastEvent = s.events[0];
		const testBtn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Enviar evento de teste' });
		testBtn.addEventListener('click', async () => {
			testBtn.disabled = true;
			try {
				const { result } = await api('/webhook-test', { method: 'POST' });
				toast(result.delivered ? 'Evento entregue (' + result.http_status + ').' : 'A Atalia não conseguiu entregar: ' + (result.error || result.http_status));
			} catch (error) {
				toast(error.message);
			} finally {
				testBtn.disabled = false;
				setTimeout(loadConnection, 800);
			}
		});

		box.replaceChildren(
			...[s.last_rejection ? el('div', { class: 'alert' }, el('strong', { text: 'Último evento recusado (' + time(s.last_rejection.at) + '): ' }), s.last_rejection.reason) : null,
			el(
				'div',
				{ class: 'steps' },
				step(
					1,
					channelsOk,
					'Chave da empresa',
					s.api_key ? null : el('p', { class: 'muted', text: 'Cadastre o segredo ATALIA_API_KEY no worker com a chave gerada na Atalia, em Chave e webhook.' }),
					s.channels_error ? el('p', {}, el('span', { class: 'pill pill-danger', text: 'Erro' }), ' ', s.channels_error) : null,
					Array.isArray(s.channels)
						? s.channels.length
							? el('table', {}, el('tr', {}, el('th', { text: 'Caixa de entrada' }), el('th', { text: 'Tipo' }), el('th', { text: 'ID' }), el('th', { text: 'Situação' })), s.channels.map((ch) => el('tr', {}, el('td', { text: ch.name || ch.phone || ch.username || ch.page_name || '' }), el('td', { text: channelType(ch.type) }), el('td', { class: 'mono', text: ch.id }), el('td', {}, el('span', { class: 'pill ' + (ch.status === 'active' ? 'pill-ok' : 'pill-warn'), text: CHANNEL_STATUS[ch.status] || ch.status })))))
							: el('p', { class: 'muted', text: 'A chave funciona, mas nenhuma caixa de entrada está conectada. Conecte uma no painel da Atalia.' })
						: null,
				),
				step(2, !!lastEvent, 'Endereço do webhook', el('p', { class: 'muted', text: 'Na Atalia, em Chave e webhook, cole este endereço e salve.' }), el('div', { class: 'copy-row' }, el('code', { text: s.webhook_url }), copyBtn(s.webhook_url))),
				step(
					3,
					s.webhook_secret === 'ok',
					'Segredo da assinatura',
					el('p', {}, el('span', { class: 'pill ' + (s.webhook_secret === 'ok' ? 'pill-ok' : 'pill-warn'), text: secretText })),
					s.webhook_secret === 'ok' ? null : el('p', { class: 'muted', text: 'Depois de salvar o endereço, a Atalia mostra o "Segredo da assinatura". Cadastre no worker como ATALIA_WEBHOOK_SECRET: no Cloudflare, em Workers › este worker › Configurações › Variáveis e segredos, ou com npx wrangler secret put ATALIA_WEBHOOK_SECRET.' }),
				),
				step(4, !!lastEvent, 'Testar', el('p', { class: 'muted', text: 'Pede para a Atalia mandar um evento ping para este worker. Depois, mande uma mensagem para o número conectado e veja a resposta em Conversas.' }), el('div', { class: 'copy-row' }, testBtn)),
				el(
					'div',
					{ class: 'card section' },
					el('h2', { text: 'Últimos eventos recebidos' }),
					s.events.length
						? el('table', {}, el('tr', {}, el('th', { text: 'Quando' }), el('th', { text: 'Tipo' }), el('th', { text: 'Resumo' })), s.events.map((ev) => el('tr', {}, el('td', { class: 'mono', text: time(ev.received_at) }), el('td', { class: 'mono', text: ev.type }), el('td', { text: ev.summary || '' }))))
						: el('p', { class: 'muted', text: 'Nenhum evento ainda.' }),
				),
			)].filter(Boolean),
		);
	}

	// ---------- clientes (revenda) ----------
	const CLIENT_STATUS = {
		invited: ['', 'Convite enviado'],
		in_progress: ['pill-warn', 'Em andamento'],
		connected: ['pill-ok', 'Conectado'],
		no_slot: ['pill-danger', 'Sem vaga no pacote'],
	};
	const RETURN_STATUS = { connected: ['pill-ok', 'Concluiu'], cancelled: ['', 'Desistiu'], no_slot: ['pill-danger', 'Sem vaga'] };

	async function loadClients() {
		const box = document.getElementById('clients');
		let data;
		try {
			data = await api('/clients');
		} catch (error) {
			box.replaceChildren(el('div', { class: 'empty', text: error.message }));
			return;
		}
		const copyBtn = (value) => el('button', { class: 'btn', type: 'button', text: 'Copiar', onclick: () => navigator.clipboard.writeText(value).then(() => toast('Copiado.')) });
		const pill = ([kind, label]) => el('span', { class: 'pill ' + kind, text: label });

		const linkBox = el('div', { class: 'copy-row', hidden: true });
		const name = el('input', { type: 'text', name: 'name', required: true, autocomplete: 'off' });
		const email = el('input', { type: 'email', name: 'email', required: true, autocomplete: 'off' });
		const taxId = el('input', { type: 'text', name: 'tax_id', inputmode: 'numeric', placeholder: 'Opcional', autocomplete: 'off' });
		const ref = el('input', { type: 'text', name: 'ref', placeholder: 'Ex.: o id do usuário no seu sistema', autocomplete: 'off' });
		const sendEmail = el('input', { type: 'checkbox' });
		const submit = el('button', { class: 'btn btn-primary', type: 'submit', text: 'Gerar link de conexão' });
		const form = el(
			'form',
			{ class: 'client-form' },
			el('label', {}, 'Nome da empresa', name),
			el('label', {}, 'E-mail', email),
			el('label', {}, 'CNPJ', taxId),
			el('label', {}, 'Referência (ref)', ref),
			el('label', { class: 'switch full' }, sendEmail, el('span', { text: 'Mandar o convite por e-mail também (com a marca da sua página)' })),
			el('div', { class: 'full' }, submit),
		);
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			submit.disabled = true;
			try {
				const res = await api('/clients', {
					method: 'POST',
					body: JSON.stringify({ name: name.value, email: email.value, tax_id: taxId.value, ref: ref.value, send_email: sendEmail.checked }),
				});
				linkBox.replaceChildren(el('code', { text: res.connect_url }), copyBtn(res.connect_url));
				linkBox.hidden = false;
				toast(res.email_sent ? 'Link gerado e enviado por e-mail.' : 'Link gerado. Mande para o cliente.');
				form.reset();
				loadClientsTable();
			} catch (error) {
				toast(error.message);
			} finally {
				submit.disabled = false;
			}
		});

		const tableBox = el('div', { class: 'table-wrap' });
		const returnsBox = el('div', { class: 'table-wrap' });
		function renderTables(d) {
			tableBox.replaceChildren(
				d.clients.length
					? el(
							'table',
							{},
							el('tr', {}, el('th', { text: 'Cliente' }), el('th', { text: 'Ref' }), el('th', { text: 'Situação' }), el('th', { text: 'Canais' }), el('th', { text: '' })),
							d.clients.map((c) => {
								const newLink = el('button', { class: 'btn', type: 'button', text: 'Link novo' });
								newLink.addEventListener('click', async () => {
									newLink.disabled = true;
									try {
										const res = await api('/clients/' + encodeURIComponent(c.id) + '/link', { method: 'POST' });
										await navigator.clipboard.writeText(res.connect_url).catch(() => {});
										toast('Link novo copiado. O anterior deixou de valer.');
									} catch (error) {
										toast(error.message);
									} finally {
										newLink.disabled = false;
									}
								});
								return el(
									'tr',
									{},
									el('td', {}, el('div', { text: c.name || c.id }), el('div', { class: 'muted', text: c.email || '' })),
									el('td', { class: 'mono', text: c.ref || '—' }),
									el('td', {}, pill(CLIENT_STATUS[c.status] || ['', c.status])),
									el('td', { text: c.channels ? c.channels.split(',').map(channelType).join(', ') : '—' }),
									el('td', {}, newLink),
								);
							}),
						)
					: el('p', { class: 'muted', text: 'Nenhum cliente ainda. Gere um link acima ou mande o link da sua página de conexão.' }),
			);
			returnsBox.replaceChildren(
				d.returns.length
					? el(
							'table',
							{},
							el('tr', {}, el('th', { text: 'Quando' }), el('th', { text: 'Resultado' }), el('th', { text: 'Cliente' }), el('th', { text: 'Ref' }), el('th', { text: 'Canais' })),
							d.returns.map((r) =>
								el(
									'tr',
									{},
									el('td', { class: 'mono', text: time(r.received_at) }),
									el('td', {}, pill(RETURN_STATUS[r.status] || ['', r.status])),
									el('td', { class: 'mono', text: r.client_id || '—' }),
									el('td', { class: 'mono', text: r.ref || '—' }),
									el('td', { text: r.channels ? r.channels.split(',').map(channelType).join(', ') : '—' }),
								),
							),
						)
					: el('p', { class: 'muted', text: 'Nenhum cliente voltou pela página ainda.' }),
			);
		}
		async function loadClientsTable() {
			try {
				renderTables(await api('/clients'));
			} catch (error) {
				toast(error.message);
			}
		}

		box.replaceChildren(
			el(
				'div',
				{ class: 'steps' },
				el(
					'div',
					{ class: 'card section' },
					el('h2', { text: 'Seus clientes conectam os próprios números' }),
					el('p', { class: 'muted', text: 'Só no modo "Integrar e oferecer aos meus clientes" da Atalia. O cliente abre o link, informa os dados da empresa, aceita os termos e conecta o WhatsApp. Quando termina, volta para este sistema e o webhook recebe client.connected.' }),
					el('h3', { text: 'Endereço de retorno' }),
					el('p', { class: 'muted', text: 'Cole na Atalia, em Página de conexão › Voltar para o seu sistema. O retorno chega assinado com o segredo do webhook e é conferido aqui.' }),
					el('div', { class: 'copy-row' }, el('code', { text: data.return_url }), copyBtn(data.return_url)),
				),
				el('div', { class: 'card section' }, el('h2', { text: 'Gerar link para um cliente' }), el('p', { class: 'muted', text: 'Cria o cliente na Atalia e devolve o link da sua página de conexão com os dados preenchidos (vale 7 dias). O ref volta no evento e no retorno.' }), form, linkBox),
				el('div', { class: 'card section' }, el('h2', { text: 'Clientes' }), tableBox),
				el('div', { class: 'card section' }, el('h2', { text: 'Últimos retornos da página' }), returnsBox),
			),
		);
		renderTables(data);
	}

	// ---------- atualização periódica ----------
	setInterval(() => {
		if (document.hidden || currentTab !== 'inbox') return;
		loadList();
		loadThread();
	}, 4000);

	loadList();
})();
</script>
</body>
</html>`;
