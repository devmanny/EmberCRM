import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
	conversationMessageTable,
	conversationTable,
} from "@/lib/db/schema/tables";
import { logger } from "@/lib/logger";
import { actionsExecutor } from "../executor";

/**
 * Transfer to Human Action Handler
 * Escalates conversation to a human agent
 */

actionsExecutor.register({
	name: "transfer-to-human",

	validate(params): boolean {
		return typeof params.conversationId === "string";
	},

	async execute(params) {
		const { conversationId, reason, priority } = params as {
			conversationId: string;
			reason?: string;
			priority?: string;
		};

		// 1. Update conversation status
		await db
			.update(conversationTable)
			.set({
				transferredToHuman: true,
				transferReason: reason || "Customer requested human assistance",
				status: "active",
			})
			.where(eq(conversationTable.id, conversationId));

		// 2. Add system message about transfer
		await db.insert(conversationMessageTable).values({
			conversationId,
			direction: "outbound",
			role: "system",
			content: `Conversation transferred to human agent. Reason: ${reason || "Customer request"}`,
			contentType: "text",
			channel: "web",
			actionTriggered: JSON.stringify({ type: "transfer-to-human", reason }),
		} as unknown as typeof conversationMessageTable.$inferInsert);

		// 3. Notify available human agents (in production)
		// - Send notification to team
		// - Create task in queue
		// - Email/Slack notification

		logger.info(
			{ conversationId, reason, priority },
			"Conversation transferred to human",
		);

		return { success: true, status: "transferred", priority };
	},
});
