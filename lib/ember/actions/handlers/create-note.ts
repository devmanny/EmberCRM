import { db } from "@/lib/db";
import { contactNoteTable } from "@/lib/db/schema/tables";
import { actionsExecutor } from "../executor";

/**
 * Create Note Action Handler
 * Creates an internal note on the contact record
 */

actionsExecutor.register({
	name: "create-note",

	validate(params): boolean {
		return (
			typeof params.contactId === "string" && typeof params.content === "string"
		);
	},

	async execute(params) {
		const { contactId, content, organizationId, createdById } = params as {
			contactId: string;
			content: string;
			organizationId: string;
			createdById: string;
		};

		await db.insert(contactNoteTable).values({
			organizationId,
			contactId,
			content,
			type: "general",
			createdById,
		});

		return { success: true };
	},
});
