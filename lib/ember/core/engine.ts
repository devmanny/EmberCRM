import { and, desc, eq, isNull } from "drizzle-orm";
import { consumeCredits } from "@/lib/billing/credits";
import { db } from "@/lib/db";
import {
	agentAssignmentTable,
	agentTable,
	conversationMessageTable,
	conversationTable,
} from "@/lib/db/schema/tables";
import { actionsExecutor } from "@/lib/ember/actions/executor";
import { channelManager } from "@/lib/ember/canales/manager";
import { logger } from "@/lib/logger";
import { buildContext } from "./context-builder";
import { decideActions } from "./decision-maker";

/**
 * Ember Core - AI Conversation Engine
 *
 * Processes incoming messages and generates AI responses using assigned agents
 */

interface ProcessMessageInput {
	conversationId: string;
	messageContent: string;
	organizationId: string;
	contactId: string;
	channel: string;
}

interface ProcessMessageResult {
	response: string;
	actionsTriggered: Array<{
		action: string;
		status: "success" | "failed";
		result?: unknown;
	}>;
	creditsUsed: number;
	model: string;
}

/**
 * Main processing function for incoming messages
 */
export async function processMessage(
	input: ProcessMessageInput,
): Promise<ProcessMessageResult> {
	const { conversationId, messageContent, organizationId, contactId, channel } =
		input;

	try {
		// 1. Get or assign agent to conversation
		const assignment = await getOrAssignAgent(conversationId, organizationId);
		if (!assignment || !assignment.agent) {
			throw new Error("No agent available for conversation");
		}

		const agent = assignment.agent as unknown as typeof agentTable.$inferSelect;

		// 2. Build context from Memoria
		const context = await buildContext(contactId, conversationId);

		// 3. Get conversation history
		const messages = await getConversationHistory(conversationId, 20);

		// 4. Prepare system prompt with agent configuration
		const systemPrompt = buildSystemPrompt(agent, context);

		// 5. Call AI model
		const aiResponse = await callAIModel({
			systemPrompt,
			messages,
			userMessage: messageContent,
			temperature: agent.temperature || 70,
			maxTokens: agent.maxTokens || 1000,
			model: agent.model,
		});

		// 6. Decide actions based on response
		const actions = await decideActions(
			aiResponse.content,
			agent,
			context,
			conversationId,
		);

		// 7. Execute actions in parallel
		const actionResults = await Promise.allSettled(
			actions.map((action) => actionsExecutor.execute(action)),
		);

		// 8. Save AI message
		await db.insert(conversationMessageTable).values({
			conversationId,
			direction: "outbound",
			role: "assistant",
			content: aiResponse.content,
			contentType: "text",
			channel,
			generatedByAi: true,
			model: agent.model,
			creditsUsed: aiResponse.tokensUsed,
			actionTriggered: actions.length > 0 ? JSON.stringify(actions) : null,
		} as unknown as typeof conversationMessageTable.$inferInsert);

		// 9. Send response through channel (saved in DB, actual sending happens via webhooks/channel adapters)
		// The response is already saved in conversationMessageTable above

		// 10. Deduct credits
		await consumeCredits({
			organizationId,
			amount: aiResponse.tokensUsed,
			description: `AI response in conversation ${conversationId}`,
			metadata: { conversationId, agentId: agent.id },
		});

		// 11. Update assignment stats
		if (assignment.id) {
			await db
				.update(agentAssignmentTable)
				.set({
					messagesHandled: (assignment.messagesHandled || 0) + 1,
					creditsUsed: (assignment.creditsUsed || 0) + aiResponse.tokensUsed,
				})
				.where(eq(agentAssignmentTable.id, assignment.id));
		}

		return {
			response: aiResponse.content,
			actionsTriggered: actionResults.map((result, i) => ({
				action: actions[i]?.type || "unknown",
				status: result.status === "fulfilled" ? "success" : "failed",
				result: result.status === "fulfilled" ? result.value : undefined,
			})),
			creditsUsed: aiResponse.tokensUsed,
			model: agent.model,
		};
	} catch (error) {
		logger.error({ error, conversationId }, "Failed to process message");
		throw error;
	}
}

/**
 * Get or assign agent to conversation
 */
async function getOrAssignAgent(
	conversationId: string,
	organizationId: string,
) {
	// Check if agent already assigned
	const existing = await db.query.agentAssignmentTable.findFirst({
		where: and(
			eq(agentAssignmentTable.conversationId, conversationId),
			isNull(agentAssignmentTable.unassignedAt),
		),
		with: {
			agent: true,
		},
	});

	if (existing) {
		return existing;
	}

	// Get conversation details for agent selection
	const conversation = await db.query.conversationTable.findFirst({
		where: eq(conversationTable.id, conversationId),
	});

	if (!conversation) {
		throw new Error("Conversation not found");
	}

	// Use agent manager to select best agent
	const { agentManager } = await import("@/lib/ember/agents/manager");
	const selectedAgent = await agentManager.selectBestAgent(organizationId, {
		channel: conversation.channel,
		contactId: conversation.contactId,
	});

	if (!selectedAgent) {
		throw new Error("No suitable agent found");
	}

	// Assign agent
	const [assignment] = await db
		.insert(agentAssignmentTable)
		.values({
			conversationId,
			agentId: selectedAgent.id,
			contactId: conversation.contactId,
		})
		.returning();

	return {
		...assignment,
		agent: selectedAgent,
	};
}

/**
 * Get conversation history
 */
async function getConversationHistory(
	conversationId: string,
	limit = 20,
): Promise<Array<{ role: string; content: string }>> {
	const messages = await db.query.conversationMessageTable.findMany({
		where: eq(conversationMessageTable.conversationId, conversationId),
		orderBy: desc(conversationMessageTable.createdAt),
		limit,
	});

	// Reverse to chronological order
	return messages
		.reverse()
		.map((msg) => ({
			role: msg.role,
			content: msg.content,
		}))
		.filter((msg) => msg.role !== "system");
}

/**
 * Build system prompt with agent configuration and context
 */
function buildSystemPrompt(
	agent: typeof agentTable.$inferSelect,
	context: ReturnType<typeof buildContext> extends Promise<infer T> ? T : never,
): string {
	const objectives =
		typeof agent.objectives === "string"
			? JSON.parse(agent.objectives)
			: agent.objectives || [];
	const knowledgeBase =
		typeof agent.knowledgeBase === "string"
			? JSON.parse(agent.knowledgeBase)
			: agent.knowledgeBase || {};

	let prompt = agent.systemPrompt + "\n\n";

	// Add objectives
	if (objectives.length > 0) {
		prompt += "## Your Objectives:\n";
		for (const objective of objectives) {
			prompt += `- ${objective}\n`;
		}
		prompt += "\n";
	}

	// Add knowledge base
	if (knowledgeBase && Object.keys(knowledgeBase).length > 0) {
		prompt += "## Knowledge Base:\n";
		prompt += JSON.stringify(knowledgeBase, null, 2) + "\n\n";
	}

	// Add contact context
	if (context) {
		prompt += "## Contact Information:\n";
		prompt += `- Name: ${context.contact.firstName} ${context.contact.lastName}\n`;
		if (context.contact.email) {
			prompt += `- Email: ${context.contact.email}\n`;
		}
		if (context.contact.phone) {
			prompt += `- Phone: ${context.contact.phone}\n`;
		}
		prompt += `- Heat Score: ${context.contact.heatScore}/100\n`;
		prompt += `- Last Interaction: ${context.contact.lastInteractionAt}\n`;
		prompt += `- Total Interactions: ${context.contact.interactionCount}\n`;

		if (context.agreements.length > 0) {
			prompt += "\n## Active Agreements:\n";
			for (const agreement of context.agreements) {
				prompt += `- ${agreement.type}: ${agreement.description}\n`;
			}
		}

		prompt += "\n";
	}

	return prompt;
}

/**
 * Call AI model (supports multiple providers)
 */
async function callAIModel(params: {
	systemPrompt: string;
	messages: Array<{ role: string; content: string }>;
	userMessage: string;
	temperature: number;
	maxTokens: number;
	model: string;
}): Promise<{ content: string; tokensUsed: number }> {
	const { systemPrompt, messages, userMessage, temperature, maxTokens, model } =
		params;

	// For now, we'll use a placeholder
	// In production, integrate with Anthropic Claude API or OpenAI
	// Based on model string: "gpt-4", "claude-3-sonnet", etc.

	// Placeholder response
	logger.info(
		{ model, messageCount: messages.length },
		"AI model call (placeholder)",
	);

	// TODO: Implement actual AI API calls
	// Example for Claude:
	/*
	const response = await anthropic.messages.create({
		model: model,
		max_tokens: maxTokens,
		temperature: temperature / 100, // Convert 0-100 to 0-1
		system: systemPrompt,
		messages: [
			...messages.map(m => ({ role: m.role, content: m.content })),
			{ role: "user", content: userMessage }
		]
	});

	return {
		content: response.content[0].text,
		tokensUsed: response.usage.input_tokens + response.usage.output_tokens
	};
	*/

	// Placeholder implementation
	return {
		content: `This is a placeholder AI response. The actual AI integration will be implemented in production. User message was: "${userMessage}"`,
		tokensUsed: 150, // Estimated tokens
	};
}

/**
 * Check if conversation should be escalated to human
 */
export async function checkEscalation(
	conversationId: string,
	agentId: string,
): Promise<boolean> {
	const agent = await db.query.agentTable.findFirst({
		where: eq(agentTable.id, agentId),
	});

	if (!agent) return false;

	const escalationRules =
		typeof agent.escalationRules === "string"
			? JSON.parse(agent.escalationRules)
			: agent.escalationRules || {};

	// Check various escalation conditions
	const conditions = {
		// Max messages without resolution
		maxMessages:
			escalationRules.maxMessages &&
			(await hasExceededMaxMessages(
				conversationId,
				escalationRules.maxMessages,
			)),

		// Negative sentiment detected
		negativeSentiment:
			escalationRules.checkSentiment &&
			(await hasNegativeSentiment(conversationId)),

		// Explicit request for human
		humanRequested: await hasRequestedHuman(conversationId),

		// Complex query beyond agent capabilities
		complexQuery:
			escalationRules.complexityThreshold &&
			(await isComplexQuery(
				conversationId,
				escalationRules.complexityThreshold,
			)),
	};

	return Object.values(conditions).some((condition) => condition);
}

async function hasExceededMaxMessages(
	conversationId: string,
	maxMessages: number,
): Promise<boolean> {
	const conversation = await db.query.conversationTable.findFirst({
		where: eq(conversationTable.id, conversationId),
	});
	return (conversation?.messageCount || 0) > maxMessages;
}

async function hasNegativeSentiment(conversationId: string): Promise<boolean> {
	const conversation = await db.query.conversationTable.findFirst({
		where: eq(conversationTable.id, conversationId),
	});
	return conversation?.sentiment === "negative";
}

async function hasRequestedHuman(conversationId: string): Promise<boolean> {
	const recentMessages = await db.query.conversationMessageTable.findMany({
		where: eq(conversationMessageTable.conversationId, conversationId),
		orderBy: desc(conversationMessageTable.createdAt),
		limit: 3,
	});

	const humanKeywords = [
		"hablar con una persona",
		"hablar con un humano",
		"atención humana",
		"agente humano",
		"speak to a human",
		"talk to a person",
		"human agent",
		"real person",
	];

	return recentMessages.some((msg) =>
		humanKeywords.some((keyword) =>
			msg.content.toLowerCase().includes(keyword),
		),
	);
}

async function isComplexQuery(
	conversationId: string,
	threshold: number,
): Promise<boolean> {
	// Placeholder - would implement complexity scoring
	return false;
}
