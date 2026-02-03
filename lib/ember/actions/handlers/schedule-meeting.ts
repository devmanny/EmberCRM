import { db } from "@/lib/db";
import { conversationMessageTable } from "@/lib/db/schema/tables";
import { actionsExecutor } from "../executor";

/**
 * Schedule Meeting Action Handler
 * Creates a meeting/appointment booking
 */

actionsExecutor.register({
	name: "schedule-meeting",

	validate(params): boolean {
		return (
			typeof params.conversationId === "string" &&
			typeof params.contactId === "string"
		);
	},

	async execute(params) {
		const { conversationId, contactId, proposedTimes } = params as {
			conversationId: string;
			contactId: string;
			proposedTimes?: string[];
		};

		// In production, this would:
		// 1. Check calendar availability
		// 2. Create meeting in Google Calendar / Calendly
		// 3. Send calendar invite
		// 4. Create reminder tasks

		// Placeholder implementation
		await db.insert(conversationMessageTable).values({
			conversationId,
			direction: "outbound",
			role: "assistant",
			content: "Meeting scheduling initiated",
			contentType: "text",
			channel: "web",
			generatedByAi: true,
			actionTriggered: JSON.stringify({
				type: "schedule-meeting",
				proposedTimes,
			}),
		} as unknown as typeof conversationMessageTable.$inferInsert);

		return { success: true, status: "pending_confirmation" };
	},
});
