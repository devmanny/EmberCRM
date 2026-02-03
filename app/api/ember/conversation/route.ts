import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
	conversationMessageTable,
	conversationTable,
} from "@/lib/db/schema/tables";
import { processMessage } from "@/lib/ember/core/engine";
import { logger } from "@/lib/logger";

/**
 * Ember Conversation API
 * Processes incoming messages and generates AI responses
 */

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { conversationId, message, organizationId, contactId, channel } =
			body;

		// Validate required fields
		if (!conversationId || !message || !organizationId || !contactId) {
			return NextResponse.json(
				{
					error:
						"Missing required fields: conversationId, message, organizationId, contactId",
				},
				{ status: 400 },
			);
		}

		// Verify conversation exists
		const conversation = await db.query.conversationTable.findFirst({
			where: eq(conversationTable.id, conversationId),
		});

		if (!conversation) {
			return NextResponse.json(
				{ error: "Conversation not found" },
				{ status: 404 },
			);
		}

		// Check if conversation is handled by human
		if (conversation.transferredToHuman) {
			return NextResponse.json(
				{
					error: "Conversation is currently handled by a human agent",
					transferredToHuman: true,
				},
				{ status: 403 },
			);
		}

		// Save incoming message
		await db.insert(conversationMessageTable).values({
			conversationId,
			direction: "inbound",
			role: "user",
			content: message,
			contentType: "text",
			channel: channel || "web",
		} as unknown as typeof conversationMessageTable.$inferInsert);

		// Update conversation
		await db
			.update(conversationTable)
			.set({
				messageCount: (conversation.messageCount || 0) + 1,
				lastMessageAt: new Date(),
			})
			.where(eq(conversationTable.id, conversationId));

		// Process message with Ember Core
		const result = await processMessage({
			conversationId,
			messageContent: message,
			organizationId,
			contactId,
			channel: channel || "web",
		});

		logger.info(
			{
				conversationId,
				creditsUsed: result.creditsUsed,
				actionsCount: result.actionsTriggered.length,
			},
			"Message processed successfully",
		);

		return NextResponse.json(
			{
				success: true,
				response: result.response,
				actions: result.actionsTriggered,
				creditsUsed: result.creditsUsed,
			},
			{ status: 200 },
		);
	} catch (error) {
		logger.error({ error }, "Failed to process conversation message");

		if (error instanceof Error) {
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}

// Get conversation history
export async function GET(req: NextRequest) {
	try {
		const url = new URL(req.url);
		const conversationId = url.searchParams.get("conversationId");

		if (!conversationId) {
			return NextResponse.json(
				{ error: "Missing conversationId" },
				{ status: 400 },
			);
		}

		// Get conversation
		const conversation = await db.query.conversationTable.findFirst({
			where: eq(conversationTable.id, conversationId),
		});

		if (!conversation) {
			return NextResponse.json(
				{ error: "Conversation not found" },
				{ status: 404 },
			);
		}

		// Get messages
		const messages = await db.query.conversationMessageTable.findMany({
			where: eq(conversationMessageTable.conversationId, conversationId),
			orderBy: (messages, { asc }) => [asc(messages.createdAt)],
		});

		return NextResponse.json(
			{
				conversation,
				messages: messages.map((msg) => ({
					id: msg.id,
					role: msg.role,
					content: msg.content,
					contentType: msg.contentType,
					createdAt: msg.createdAt,
					generatedByAi: msg.generatedByAi,
				})),
			},
			{ status: 200 },
		);
	} catch (error) {
		logger.error({ error }, "Failed to fetch conversation");
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
