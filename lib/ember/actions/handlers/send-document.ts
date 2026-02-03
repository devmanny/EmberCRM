import { db } from "@/lib/db";
import { conversationMessageTable } from "@/lib/db/schema/tables";
import { actionsExecutor } from "../executor";

/**
 * Send Document Action Handler
 * Sends a document attachment in the conversation
 */

actionsExecutor.register({
	name: "send-document",

	validate(params): boolean {
		return (
			typeof params.conversationId === "string" &&
			typeof params.documentType === "string"
		);
	},

	async execute(params) {
		const { conversationId, documentType, documentUrl } = params as {
			conversationId: string;
			documentType: string;
			documentUrl?: string;
		};

		// In production, this would:
		// 1. Generate/fetch the document
		// 2. Upload to S3
		// 3. Send via channel manager

		// Placeholder implementation
		await db.insert(conversationMessageTable).values({
			conversationId,
			direction: "outbound",
			role: "assistant",
			content: `Document sent: ${documentType}`,
			contentType: "document",
			channel: "web",
			generatedByAi: true,
			mediaUrl: documentUrl || null,
			actionTriggered: JSON.stringify({ type: "send-document", documentType }),
		} as unknown as typeof conversationMessageTable.$inferInsert);

		return { success: true, documentType };
	},
});
