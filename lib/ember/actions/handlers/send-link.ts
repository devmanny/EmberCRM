import { db } from "@/lib/db";
import { conversationMessageTable } from "@/lib/db/schema/tables";
import { actionsExecutor } from "../executor";

/**
 * Send Link Action Handler
 * Sends a clickable link in the conversation
 */

actionsExecutor.register({
	name: "send-link",

	validate(params): boolean {
		return (
			typeof params.conversationId === "string" &&
			typeof params.url === "string" &&
			(params.url as string).startsWith("http")
		);
	},

	async execute(params) {
		const { conversationId, url, title } = params as {
			conversationId: string;
			url: string;
			title?: string;
		};

		// Save link message
		await db.insert(conversationMessageTable).values({
			conversationId,
			direction: "outbound",
			role: "assistant",
			content: title ? `${title}: ${url}` : url,
			contentType: "text",
			channel: "web",
			generatedByAi: true,
			actionTriggered: JSON.stringify({ type: "send-link", url, title }),
		} as unknown as typeof conversationMessageTable.$inferInsert);

		return { success: true, url };
	},
});
