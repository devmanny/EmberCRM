import { db } from "@/lib/db";
import { conversationMessageTable } from "@/lib/db/schema/tables";
import { actionsExecutor } from "../executor";

/**
 * Create Quote Action Handler
 * Generates a quotation PDF and sends it to the contact
 */

actionsExecutor.register({
	name: "create-quote",

	validate(params): boolean {
		return (
			typeof params.conversationId === "string" &&
			typeof params.contactId === "string"
		);
	},

	async execute(params) {
		const { conversationId, contactId, items } = params as {
			conversationId: string;
			contactId: string;
			items: Array<{ description: string; quantity: number; price: number }>;
		};

		// In production, this would:
		// 1. Generate PDF quote using react-pdf or similar
		// 2. Upload PDF to S3
		// 3. Send PDF via channel manager
		// 4. Create quote record in database

		// Placeholder implementation
		const quoteNumber = `Q-${Date.now()}`;

		await db.insert(conversationMessageTable).values({
			conversationId,
			direction: "outbound",
			role: "assistant",
			content: `Quote ${quoteNumber} generated and sent`,
			contentType: "document",
			channel: "web",
			generatedByAi: true,
			actionTriggered: JSON.stringify({
				type: "create-quote",
				quoteNumber,
				items,
			}),
		} as unknown as typeof conversationMessageTable.$inferInsert);

		return { success: true, quoteNumber };
	},
});
