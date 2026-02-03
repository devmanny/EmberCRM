import type { agentTable } from "@/lib/db/schema/tables";
import type { ContactContext } from "./context-builder";

/**
 * Decision Maker - Analyzes AI responses and decides what actions to trigger
 *
 * Uses pattern matching and rules to determine appropriate actions
 */

export interface Action {
	type: string;
	params: Record<string, unknown>;
	priority: number;
}

/**
 * Decide actions based on AI response and context
 */
export async function decideActions(
	aiResponse: string,
	agent: typeof agentTable.$inferSelect,
	context: ContactContext,
	conversationId: string,
): Promise<Action[]> {
	const actions: Action[] = [];

	// Parse allowed actions
	const allowedActions =
		typeof agent.allowedActions === "string"
			? JSON.parse(agent.allowedActions)
			: agent.allowedActions || [];

	// Extract intent from response
	const intent = detectIntent(aiResponse);

	// 1. Check for link sending intent
	if (
		allowedActions.includes("send-link") &&
		(intent.includes("link") || aiResponse.includes("http"))
	) {
		const urls = extractUrls(aiResponse);
		for (const url of urls) {
			actions.push({
				type: "send-link",
				params: {
					conversationId,
					url,
					title: extractLinkTitle(aiResponse, url),
				},
				priority: 5,
			});
		}
	}

	// 2. Check for document sending
	if (
		allowedActions.includes("send-document") &&
		(intent.includes("document") || intent.includes("file"))
	) {
		// Would extract document details from response
		actions.push({
			type: "send-document",
			params: {
				conversationId,
				documentType: detectDocumentType(aiResponse),
			},
			priority: 7,
		});
	}

	// 3. Check for quotation creation
	if (
		allowedActions.includes("create-quote") &&
		(intent.includes("quote") ||
			intent.includes("price") ||
			intent.includes("cost"))
	) {
		actions.push({
			type: "create-quote",
			params: {
				conversationId,
				contactId: context.contact.id,
				items: extractQuoteItems(aiResponse),
			},
			priority: 9,
		});
	}

	// 4. Check for meeting scheduling
	if (
		allowedActions.includes("schedule-meeting") &&
		(intent.includes("meeting") ||
			intent.includes("appointment") ||
			intent.includes("call"))
	) {
		actions.push({
			type: "schedule-meeting",
			params: {
				conversationId,
				contactId: context.contact.id,
				proposedTimes: extractTimeProposals(aiResponse),
			},
			priority: 8,
		});
	}

	// 5. Check for escalation to human
	if (
		allowedActions.includes("transfer-to-human") &&
		shouldEscalate(aiResponse, context)
	) {
		actions.push({
			type: "transfer-to-human",
			params: {
				conversationId,
				reason: extractEscalationReason(aiResponse),
				priority: "high",
			},
			priority: 10, // Highest priority
		});
	}

	// 6. Check for note creation
	if (allowedActions.includes("create-note") && intent.includes("important")) {
		actions.push({
			type: "create-note",
			params: {
				contactId: context.contact.id,
				content: aiResponse,
				isImportant: true,
			},
			priority: 3,
		});
	}

	// 7. Check for tag update
	if (allowedActions.includes("update-tags")) {
		const newTags = extractTags(aiResponse, context);
		if (newTags.length > 0) {
			actions.push({
				type: "update-tags",
				params: {
					contactId: context.contact.id,
					tags: newTags,
				},
				priority: 2,
			});
		}
	}

	// 8. Check for product search (if inventory enabled)
	if (
		allowedActions.includes("search-product") &&
		(intent.includes("product") || intent.includes("stock"))
	) {
		const searchQuery = extractProductQuery(aiResponse);
		if (searchQuery) {
			actions.push({
				type: "search-product",
				params: {
					query: searchQuery,
					conversationId,
				},
				priority: 6,
			});
		}
	}

	// Sort by priority (highest first)
	return actions.sort((a, b) => b.priority - a.priority);
}

/**
 * Detect intent from AI response
 */
function detectIntent(response: string): string[] {
	const intents: string[] = [];
	const lowerResponse = response.toLowerCase();

	const intentPatterns = {
		link: [
			"enviar enlace",
			"aquí está el link",
			"puedes ver en",
			"send link",
			"here's the link",
		],
		document: [
			"enviar documento",
			"adjunto",
			"archivo",
			"send document",
			"attachment",
			"file",
		],
		quote: [
			"cotización",
			"presupuesto",
			"precio",
			"costo",
			"quote",
			"estimate",
			"price",
		],
		meeting: [
			"reunión",
			"cita",
			"llamada",
			"agendar",
			"meeting",
			"appointment",
			"schedule",
		],
		escalate: [
			"transferir",
			"hablar con",
			"agente humano",
			"transfer",
			"speak with",
			"human agent",
		],
		product: [
			"producto",
			"inventario",
			"stock",
			"disponible",
			"product",
			"inventory",
			"available",
		],
		important: [
			"importante",
			"nota",
			"recordar",
			"important",
			"note",
			"remember",
		],
	};

	for (const [intent, patterns] of Object.entries(intentPatterns)) {
		if (patterns.some((pattern) => lowerResponse.includes(pattern))) {
			intents.push(intent);
		}
	}

	return intents;
}

/**
 * Extract URLs from text
 */
function extractUrls(text: string): string[] {
	const urlRegex = /(https?:\/\/[^\s]+)/g;
	return text.match(urlRegex) || [];
}

/**
 * Extract link title from context
 */
function extractLinkTitle(text: string, url: string): string {
	// Try to find text before/after URL
	const urlIndex = text.indexOf(url);
	if (urlIndex > 0) {
		const beforeUrl = text.substring(Math.max(0, urlIndex - 50), urlIndex);
		const match = beforeUrl.match(/([^.!?]+)$/);
		if (match && match[1]) return match[1].trim();
	}
	return "Link";
}

/**
 * Detect document type from response
 */
function detectDocumentType(response: string): string {
	if (response.toLowerCase().includes("pdf")) return "pdf";
	if (response.toLowerCase().includes("contrato")) return "contract";
	if (response.toLowerCase().includes("factura")) return "invoice";
	if (response.toLowerCase().includes("recibo")) return "receipt";
	return "document";
}

/**
 * Extract quote items from response
 */
function extractQuoteItems(response: string): Array<{
	description: string;
	quantity: number;
	price: number;
}> {
	// Placeholder - would implement proper parsing
	return [];
}

/**
 * Extract time proposals from response
 */
function extractTimeProposals(response: string): string[] {
	// Placeholder - would implement proper date/time extraction
	const proposals: string[] = [];

	const timePatterns = [
		/(\d{1,2}:\d{2}\s*(?:am|pm)?)/gi,
		/(mañana|tarde|noche)/gi,
		/(lunes|martes|miércoles|jueves|viernes|sábado|domingo)/gi,
	];

	for (const pattern of timePatterns) {
		const matches = response.match(pattern);
		if (matches) proposals.push(...matches);
	}

	return proposals;
}

/**
 * Check if conversation should be escalated
 */
function shouldEscalate(response: string, context: ContactContext): boolean {
	const lowerResponse = response.toLowerCase();

	// Explicit escalation phrases
	const escalationPhrases = [
		"transferir",
		"conectar con",
		"hablar con un agente",
		"necesita asistencia especializada",
		"transfer",
		"connect with",
		"speak to an agent",
		"needs specialized assistance",
	];

	if (escalationPhrases.some((phrase) => lowerResponse.includes(phrase))) {
		return true;
	}

	// Escalate VIP contacts for certain intents
	if (
		context.contact.tags.includes("vip") &&
		context.contact.lifetimeValue > 100000
	) {
		return true;
	}

	return false;
}

/**
 * Extract escalation reason
 */
function extractEscalationReason(response: string): string {
	// Try to extract reason from response
	const reasonMatch = response.match(
		/(?:porque|debido a|razón:?)\s*([^.!?]+)/i,
	);
	return reasonMatch && reasonMatch[1]
		? reasonMatch[1].trim()
		: "Complex query";
}

/**
 * Extract tags to add from conversation
 */
function extractTags(response: string, context: ContactContext): string[] {
	const newTags: string[] = [];

	// Detect interest tags
	if (
		response.toLowerCase().includes("interesado") ||
		response.toLowerCase().includes("interested")
	) {
		newTags.push("interested");
	}

	// Detect stage tags
	if (
		response.toLowerCase().includes("cotización") ||
		response.toLowerCase().includes("quote")
	) {
		newTags.push("quote-requested");
	}

	// Only return tags not already present
	return newTags.filter((tag) => !context.contact.tags.includes(tag));
}

/**
 * Extract product search query
 */
function extractProductQuery(response: string): string | null {
	// Simple extraction - in production, use NLP
	const productMatch = response.match(/(?:producto|product):\s*([^.!?]+)/i);
	if (productMatch && productMatch[1]) return productMatch[1].trim();

	const searchMatch = response.match(/(?:buscar|search):\s*([^.!?]+)/i);
	if (searchMatch && searchMatch[1]) return searchMatch[1].trim();

	return null;
}
