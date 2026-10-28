/**
 * O agente: configuração (editável no painel, aba Agente), quando passar para uma pessoa e a chamada ao modelo.
 *
 * Modelo `@cf/...` roda no Workers AI (sem chave). Qualquer outro nome (ex.: `gpt-4.1-mini`) vai para a
 * OpenAI e precisa do segredo OPENAI_API_KEY.
 */

export const DEFAULT_AGENT = Object.freeze({
	enabled: true,
	name: 'Ana',
	instructions: [
		'Você é a Ana, assistente virtual da Loja Exemplo.',
		'Responda em português do Brasil, de forma simpática e curta (no máximo 3 frases).',
		'A loja abre de segunda a sábado, das 9h às 18h, e faz entregas na cidade em até 2 dias úteis.',
		'Se não souber a resposta, diga que vai chamar uma pessoa da equipe. Nunca invente preços, prazos ou políticas.',
	].join('\n'),
	model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
	history_limit: 20,
	handoff_keywords: ['atendente', 'humano', 'pessoa'],
	handoff_message: 'Certo! Vou chamar uma pessoa da equipe para continuar com você por aqui.',
	media_reply: 'Recebi seu arquivo! Por enquanto eu só consigo ler texto. Pode me contar em uma mensagem o que você precisa?',
	pause_on_human_reply: true,
});

const MODEL_PATTERN = /^(@cf\/[\w.\-/]+|[\w.\-:]+)$/;

const str = (value, max, fallback) => (typeof value === 'string' ? value.trim().slice(0, max) : fallback);
const bool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

/** Junta o que veio do painel (ou do banco) com o padrão, descartando campo desconhecido ou inválido. */
export function normalizeAgent(input = {}, base = DEFAULT_AGENT) {
	const src = input && typeof input === 'object' ? input : {};
	const keywords = Array.isArray(src.handoff_keywords)
		? src.handoff_keywords
		: typeof src.handoff_keywords === 'string'
			? src.handoff_keywords.split(',')
			: base.handoff_keywords;
	const historyLimit = Number.parseInt(src.history_limit, 10);
	const model = str(src.model, 100, base.model);
	return {
		enabled: bool(src.enabled, base.enabled),
		name: str(src.name, 60, base.name) || base.name,
		instructions: str(src.instructions, 4000, base.instructions) || base.instructions,
		model: MODEL_PATTERN.test(model) ? model : base.model,
		history_limit: Number.isFinite(historyLimit) ? Math.min(50, Math.max(2, historyLimit)) : base.history_limit,
		handoff_keywords: keywords
			.map((k) => String(k).trim().toLowerCase().slice(0, 40))
			.filter(Boolean)
			.slice(0, 10),
		handoff_message: str(src.handoff_message, 500, base.handoff_message),
		media_reply: str(src.media_reply, 500, base.media_reply),
		pause_on_human_reply: bool(src.pause_on_human_reply, base.pause_on_human_reply),
	};
}

const fold = (text) =>
	String(text || '')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase();

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** O cliente pediu uma pessoa? Palavra inteira, sem diferenciar acento nem maiúscula ("Atendente!" casa). */
export function wantsHuman(text, keywords) {
	const folded = fold(text);
	return (keywords || []).some((keyword) => {
		const k = fold(keyword).trim();
		return k && new RegExp(`(^|[^a-z0-9])${escapeRegExp(k)}([^a-z0-9]|$)`).test(folded);
	});
}

/** Monta a conversa para o modelo: instruções + histórico (cliente = user; agente, painel e app = assistant). */
export function buildPrompt(agent, history, contactName) {
	const system = contactName ? `${agent.instructions}\n\nO nome do cliente é ${contactName}.` : agent.instructions;
	return [
		{ role: 'system', content: system },
		...history.filter((m) => m.text).map((m) => ({ role: m.author === 'contact' ? 'user' : 'assistant', content: m.text })),
	];
}

export async function generateReply(env, agent, messages) {
	const text = agent.model.startsWith('@cf/') ? await runWorkersAi(env, agent.model, messages) : await runOpenAi(env, agent.model, messages);
	const reply = String(text || '').trim();
	if (!reply) throw new Error('O modelo devolveu uma resposta vazia.');
	return reply.slice(0, 4000);
}

async function runWorkersAi(env, model, messages) {
	const result = await env.AI.run(model, { messages, max_tokens: 400 });
	// Modelos antigos devolvem { response }, os novos o formato da OpenAI
	return result?.response ?? result?.choices?.[0]?.message?.content;
}

async function runOpenAi(env, model, messages) {
	if (!env.OPENAI_API_KEY) throw new Error(`O modelo ${model} é da OpenAI: configure o segredo OPENAI_API_KEY.`);
	const res = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ model, messages, max_completion_tokens: 400 }),
	});
	const payload = await res.json().catch(() => null);
	if (!res.ok) throw new Error(`OpenAI ${res.status}: ${payload?.error?.message || 'erro'}`);
	return payload?.choices?.[0]?.message?.content;
}
