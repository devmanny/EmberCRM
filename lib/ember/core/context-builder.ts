import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	contactAgreementTable,
	contactNoteTable,
	contactTable,
	conversationMessageTable,
} from "@/lib/db/schema/tables";

/**
 * Context Builder - Constructs comprehensive context from Memoria
 *
 * Gathers all relevant information about a contact for AI processing
 */

export interface ContactContext {
	contact: {
		id: string;
		firstName: string;
		lastName: string;
		email: string | null;
		phone: string | null;
		company: string | null;
		heatScore: number;
		tags: string[];
		channelPreference: string | null;
		timezone: string | null;
		language: string | null;
		lastInteractionAt: Date | null;
		lastInteractionChannel: string | null;
		interactionCount: number;
		lifetimeValue: number;
		customFields: Record<string, unknown>;
	};
	agreements: Array<{
		id: string;
		type: string;
		description: string;
		details: Record<string, unknown>;
		status: string;
		createdAt: Date;
	}>;
	notes: Array<{
		id: string;
		content: string;
		createdAt: Date;
		createdBy: string | null;
	}>;
	conversationSummary: {
		messageCount: number;
		firstMessage: Date | null;
		lastMessage: Date | null;
		topics: string[];
		sentiment: string | null;
	};
}

/**
 * Build complete context for a contact
 */
export async function buildContext(
	contactId: string,
	conversationId: string,
): Promise<ContactContext> {
	// Get contact information
	const contact = await db.query.contactTable.findFirst({
		where: eq(contactTable.id, contactId),
	});

	if (!contact) {
		throw new Error("Contact not found");
	}

	// Parse JSON fields
	const tags =
		typeof contact.tags === "string" ? JSON.parse(contact.tags) : contact.tags;
	const customFields =
		typeof contact.customFields === "string"
			? JSON.parse(contact.customFields)
			: contact.customFields || {};

	// Get active agreements
	const agreements = await db.query.contactAgreementTable.findMany({
		where: and(
			eq(contactAgreementTable.contactId, contactId),
			eq(contactAgreementTable.status, "active"),
		),
		orderBy: desc(contactAgreementTable.createdAt),
	});

	// Get internal notes
	const notes = await db.query.contactNoteTable.findMany({
		where: eq(contactNoteTable.contactId, contactId),
		orderBy: desc(contactNoteTable.createdAt),
		limit: 10,
	});

	// Get conversation summary
	const conversationSummary = await buildConversationSummary(conversationId);

	return {
		contact: {
			id: contact.id,
			firstName: contact.firstName,
			lastName: contact.lastName,
			email: contact.email,
			phone: contact.phone,
			company: contact.company,
			heatScore: contact.heatScore,
			tags: tags || [],
			channelPreference: contact.channelPreference,
			timezone: contact.timezone,
			language: contact.language,
			lastInteractionAt: contact.lastInteractionAt,
			lastInteractionChannel: contact.lastInteractionChannel,
			interactionCount: contact.interactionCount,
			lifetimeValue: contact.lifetimeValue,
			customFields,
		},
		agreements: agreements.map((agreement) => ({
			id: agreement.id,
			type: agreement.type,
			description: agreement.description,
			details:
				typeof agreement.details === "string"
					? JSON.parse(agreement.details)
					: agreement.details || {},
			status: agreement.status,
			createdAt: agreement.createdAt,
		})),
		notes: notes.map((note) => ({
			id: note.id,
			content: note.content,
			createdAt: note.createdAt,
			createdBy: note.createdById,
		})),
		conversationSummary,
	};
}

/**
 * Build conversation summary
 */
async function buildConversationSummary(conversationId: string): Promise<{
	messageCount: number;
	firstMessage: Date | null;
	lastMessage: Date | null;
	topics: string[];
	sentiment: string | null;
}> {
	const messages = await db.query.conversationMessageTable.findMany({
		where: eq(conversationMessageTable.conversationId, conversationId),
		orderBy: desc(conversationMessageTable.createdAt),
	});

	if (messages.length === 0) {
		return {
			messageCount: 0,
			firstMessage: null,
			lastMessage: null,
			topics: [],
			sentiment: null,
		};
	}

	// Extract topics from messages (simple keyword extraction)
	const topics = extractTopics(messages.map((m) => m.content));

	// Analyze sentiment (simple heuristic)
	const sentiment = analyzeSentiment(messages.map((m) => m.content));

	return {
		messageCount: messages.length,
		firstMessage: messages[messages.length - 1]?.createdAt || null,
		lastMessage: messages[0]?.createdAt || null,
		topics,
		sentiment,
	};
}

/**
 * Extract topics from conversation
 */
function extractTopics(messages: string[]): string[] {
	// Simple keyword extraction - in production, use NLP
	const keywords = [
		"precio",
		"costo",
		"envío",
		"entrega",
		"pago",
		"garantía",
		"devolución",
		"descuento",
		"promoción",
		"producto",
		"servicio",
		"soporte",
		"técnico",
		"instalación",
		"configuración",
		"price",
		"cost",
		"shipping",
		"delivery",
		"payment",
		"warranty",
		"return",
		"discount",
		"promotion",
		"product",
		"service",
		"support",
		"technical",
		"installation",
		"setup",
	];

	const foundTopics = new Set<string>();

	for (const message of messages) {
		const lowerMessage = message.toLowerCase();
		for (const keyword of keywords) {
			if (lowerMessage.includes(keyword)) {
				foundTopics.add(keyword);
			}
		}
	}

	return Array.from(foundTopics).slice(0, 5);
}

/**
 * Analyze sentiment from conversation
 */
function analyzeSentiment(messages: string[]): string {
	// Simple sentiment analysis - in production, use proper NLP
	const positiveWords = [
		"gracias",
		"excelente",
		"perfecto",
		"genial",
		"bueno",
		"bien",
		"happy",
		"thanks",
		"excellent",
		"perfect",
		"great",
		"good",
	];
	const negativeWords = [
		"problema",
		"mal",
		"error",
		"molesto",
		"frustrado",
		"enojado",
		"problema",
		"issue",
		"bad",
		"error",
		"annoying",
		"frustrated",
		"angry",
		"problem",
	];

	let positiveCount = 0;
	let negativeCount = 0;

	for (const message of messages) {
		const lowerMessage = message.toLowerCase();
		for (const word of positiveWords) {
			if (lowerMessage.includes(word)) positiveCount++;
		}
		for (const word of negativeWords) {
			if (lowerMessage.includes(word)) negativeCount++;
		}
	}

	if (positiveCount > negativeCount * 2) return "positive";
	if (negativeCount > positiveCount * 2) return "negative";
	return "neutral";
}

/**
 * Build minimal context (for quick responses)
 */
export async function buildMinimalContext(contactId: string): Promise<{
	firstName: string;
	lastName: string;
	email: string | null;
	phone: string | null;
	heatScore: number;
	tags: string[];
}> {
	const contact = await db.query.contactTable.findFirst({
		where: eq(contactTable.id, contactId),
		columns: {
			firstName: true,
			lastName: true,
			email: true,
			phone: true,
			heatScore: true,
			tags: true,
		},
	});

	if (!contact) {
		throw new Error("Contact not found");
	}

	const tags =
		typeof contact.tags === "string" ? JSON.parse(contact.tags) : contact.tags;

	return {
		firstName: contact.firstName,
		lastName: contact.lastName,
		email: contact.email,
		phone: contact.phone,
		heatScore: contact.heatScore,
		tags: tags || [],
	};
}
